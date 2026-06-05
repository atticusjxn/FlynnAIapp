package com.flynnai.app.billing

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.flynnai.app.core.Environment
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.bearerAuth
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlin.coroutines.resume

// Product IDs — must match what you register in Play Console
const val PRODUCT_PRO_MONTHLY = "com.flynnai.app.pro_monthly"
const val PRODUCT_PRO_ANNUAL = "com.flynnai.app.pro_annual"

sealed interface PurchaseState {
    data object Idle : PurchaseState
    data class Purchasing(val productId: String) : PurchaseState
    data object Success : PurchaseState
    data class Failed(val msg: String) : PurchaseState
}

class BillingManager(context: Context) : PurchasesUpdatedListener {

    private val _purchaseState = MutableStateFlow<PurchaseState>(PurchaseState.Idle)
    val purchaseState = _purchaseState.asStateFlow()

    private val _isPro = MutableStateFlow(false)
    val isPro = _isPro.asStateFlow()

    private val http = HttpClient(Android) {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
    }

    private val billing = BillingClient.newBuilder(context)
        .setListener(this)
        .enablePendingPurchases()
        .build()

    private var productDetails: Map<String, ProductDetails> = emptyMap()

    fun connect(onReady: (Boolean) -> Unit) {
        billing.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                onReady(result.responseCode == BillingClient.BillingResponseCode.OK)
            }
            override fun onBillingServiceDisconnected() { onReady(false) }
        })
    }

    suspend fun loadProducts(): List<ProductDetails> {
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                listOf(PRODUCT_PRO_MONTHLY, PRODUCT_PRO_ANNUAL).map { id ->
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(id)
                        .setProductType(BillingClient.ProductType.SUBS)
                        .build()
                }
            ).build()

        return suspendCancellableCoroutine { cont ->
            billing.queryProductDetailsAsync(params) { result, details ->
                if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                    productDetails = details.associateBy { it.productId }
                    cont.resume(details)
                } else {
                    cont.resume(emptyList())
                }
            }
        }
    }

    fun launchPurchase(activity: Activity, productId: String) {
        val details = productDetails[productId] ?: run {
            _purchaseState.value = PurchaseState.Failed("Product not found")
            return
        }
        val offerToken = details.subscriptionOfferDetails?.firstOrNull()?.offerToken ?: run {
            _purchaseState.value = PurchaseState.Failed("No offer available")
            return
        }
        val params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(
                listOf(
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(details)
                        .setOfferToken(offerToken)
                        .build()
                )
            ).build()
        _purchaseState.value = PurchaseState.Purchasing(productId)
        billing.launchBillingFlow(activity, params)
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: List<Purchase>?) {
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> purchases?.forEach { handlePurchase(it) }
            BillingClient.BillingResponseCode.USER_CANCELED -> _purchaseState.value = PurchaseState.Idle
            else -> _purchaseState.value = PurchaseState.Failed("Purchase failed: ${result.debugMessage}")
        }
    }

    private fun handlePurchase(purchase: Purchase) {
        if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) return
        @Suppress("OPT_IN_USAGE")
        GlobalScope.launch(Dispatchers.IO) {
            verifyWithBackend(purchase)
            if (!purchase.isAcknowledged) {
                billing.acknowledgePurchase(
                    AcknowledgePurchaseParams.newBuilder().setPurchaseToken(purchase.purchaseToken).build()
                ) {}
            }
            _isPro.value = true
            _purchaseState.value = PurchaseState.Success
        }
    }

    private suspend fun verifyWithBackend(purchase: Purchase) {
        try {
            @Serializable data class Req(val purchaseToken: String, val productId: String, val packageName: String)
            http.post("${Environment.flynnApiBaseUrl}/webhooks/playbilling/verify") {
                contentType(ContentType.Application.Json)
                setBody(Req(purchase.purchaseToken, purchase.products.firstOrNull() ?: "", purchase.packageName))
            }
        } catch (_: Exception) {}
    }

    suspend fun checkCurrentEntitlement() {
        val result = suspendCancellableCoroutine<List<Purchase>> { cont ->
            billing.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()
            ) { _, purchases -> cont.resume(purchases) }
        }
        _isPro.value = result.any { it.purchaseState == Purchase.PurchaseState.PURCHASED }
    }

    fun disconnect() { billing.endConnection() }
}
