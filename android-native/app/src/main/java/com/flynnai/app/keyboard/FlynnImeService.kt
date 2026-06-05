package com.flynnai.app.keyboard

import android.content.ClipboardManager
import android.content.Context
import android.inputmethodservice.InputMethodService
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.FrameLayout
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.savedstate.SavedStateRegistry
import androidx.savedstate.SavedStateRegistryController
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import com.flynnai.app.capture.staging.CaptureStagingStore
import com.flynnai.app.capture.staging.StagedDraft
import com.flynnai.app.data.api.FlynnApi
import com.flynnai.app.ui.theme.FlynnBackground
import com.flynnai.app.ui.theme.FlynnCard
import com.flynnai.app.ui.theme.FlynnInk
import com.flynnai.app.ui.theme.FlynnOrange
import com.flynnai.app.ui.theme.FlynnTextSecondary
import com.flynnai.app.ui.theme.FlynnTextTertiary
import com.flynnai.app.ui.theme.FlynnTheme
import com.flynnai.app.ui.theme.FlynnTypography
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class FlynnImeService : InputMethodService(), LifecycleOwner, SavedStateRegistryOwner {

    // Lifecycle boilerplate needed for Compose inside an IME service
    private val lifecycleRegistry = LifecycleRegistry(this)
    override val lifecycle: Lifecycle get() = lifecycleRegistry

    private val savedStateRegistryController = SavedStateRegistryController.create(this)
    override val savedStateRegistry: SavedStateRegistry get() = savedStateRegistryController.savedStateRegistry

    private var lastClipHash: Int = -1

    // Bumped on every keyboard show so Compose re-evaluates the capture pickup. `onCreateInputView`
    // (and its LaunchedEffect) runs only once, so without this a second field-show would not pick
    // up a freshly-staged draft.
    private val pickupTrigger = MutableStateFlow(0L)

    override fun onCreate() {
        super.onCreate()
        savedStateRegistryController.performRestore(null)
        lifecycleRegistry.currentState = Lifecycle.State.CREATED
    }

    override fun onStartInput(attribute: EditorInfo?, restarting: Boolean) {
        super.onStartInput(attribute, restarting)
        lifecycleRegistry.currentState = Lifecycle.State.RESUMED
    }

    override fun onStartInputView(info: EditorInfo?, restarting: Boolean) {
        super.onStartInputView(info, restarting)
        // Re-evaluate pickup priority each time the keyboard becomes visible.
        pickupTrigger.value = System.currentTimeMillis()
    }

    override fun onFinishInput() {
        super.onFinishInput()
        lifecycleRegistry.currentState = Lifecycle.State.STARTED
    }

    override fun onDestroy() {
        super.onDestroy()
        lifecycleRegistry.currentState = Lifecycle.State.DESTROYED
    }

    override fun onCreateInputView(): View {
        val frame = FrameLayout(this)
        val composeView = ComposeView(this).apply {
            setViewTreeLifecycleOwner(this@FlynnImeService)
            setViewTreeSavedStateRegistryOwner(this@FlynnImeService)
            setContent {
                FlynnTheme {
                    ImeContent(
                        context = this@FlynnImeService,
                        pickupTrigger = pickupTrigger,
                        onCommit = { text -> currentInputConnection?.commitText(text, 1) },
                        onSwitchKeyboard = { switchToNextInputMethod(false) },
                        freshClip = { freshClip() },
                        clipText = { clipText() },
                    )
                }
            }
        }
        frame.addView(composeView)
        return frame
    }

    private fun clipText(): String? {
        val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        return cm.primaryClip?.getItemAt(0)?.text?.toString()?.trim()?.ifBlank { null }
    }

    private fun freshClip(): Boolean {
        val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        val text = cm.primaryClip?.getItemAt(0)?.text?.toString() ?: return false
        val hash = text.hashCode()
        if (hash == lastClipHash) return false
        lastClipHash = hash
        return true
    }
}

// ─────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────

private const val STAGED_FRESH_MS = 8_000L

private sealed interface ImeState {
    data object Idle : ImeState
    data object Loading : ImeState
    data class Results(
        val drafts: List<String>,
        val index: Int,
        val sender: String?,
        val source: String,
        val messages: List<String>,
    ) : ImeState
    data class StatusMessage(val text: String) : ImeState
}

// ─────────────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────────────

@Composable
private fun ImeContent(
    context: Context,
    pickupTrigger: StateFlow<Long>,
    onCommit: (String) -> Unit,
    onSwitchKeyboard: () -> Unit,
    freshClip: () -> Boolean,
    clipText: () -> String?,
) {
    var state by remember { mutableStateOf<ImeState>(ImeState.Idle) }
    val scope = rememberCoroutineScope()

    // Re-run pickup on every keyboard show (pickupTrigger changes), plus once on first composition.
    val trigger by pickupTrigger.collectAsState()
    LaunchedEffect(trigger) {
        runPickup(
            context = context,
            scope = scope,
            freshClip = freshClip,
            clipText = clipText,
            onStateChange = { state = it },
        )
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(FlynnBackground)
            .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        // Header row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            val headerLabel = (state as? ImeState.Results)?.sender?.let { "Replying to $it" }
                ?: KeyboardTokenStore.getBusinessName(context)?.let { "Flynn · $it" }
                ?: "Flynn"
            Text(
                text = headerLabel,
                style = FlynnTypography.labelMedium,
                color = FlynnTextSecondary,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = {
                    val clip = clipText()
                    if (clip == null) {
                        state = ImeState.StatusMessage("Copy a message first, then tap ↻ Redraft.")
                    } else {
                        triggerDraft(context, listOf(clip), FlynnApi.Source.CLIPBOARD, null, scope) { state = it }
                    }
                }) {
                    Text("↻ Redraft", color = FlynnOrange, style = FlynnTypography.labelMedium)
                }
                Spacer(Modifier.width(4.dp))
                TextButton(onClick = onSwitchKeyboard) {
                    Text("🌐", style = FlynnTypography.bodyLarge)
                }
            }
        }

        Spacer(Modifier.height(6.dp))

        AnimatedContent(
            targetState = state,
            transitionSpec = { fadeIn() togetherWith fadeOut() },
            label = "imeContent",
        ) { s ->
            when (s) {
                is ImeState.Idle -> StatusText("Copy a message, or capture a chat — drafts appear here.")
                is ImeState.Loading -> LoadingView()
                is ImeState.StatusMessage -> StatusText(s.text)
                is ImeState.Results -> DraftCard(
                    drafts = s.drafts,
                    index = s.index,
                    onNext = { state = s.copy(index = (s.index + 1).coerceAtMost(s.drafts.lastIndex)) },
                    onPrev = { state = s.copy(index = (s.index - 1).coerceAtLeast(0)) },
                    onInsert = { text ->
                        onCommit(text)
                        // Fire-and-forget learning signal with full contrastive context.
                        KeyboardTokenStore.getToken(context)?.let { token ->
                            FlynnApi.recordAccepted(
                                text = text,
                                token = token,
                                source = s.source,
                                candidates = s.drafts,
                                pickedIndex = s.index,
                                messages = s.messages.ifEmpty { null },
                            )
                        }
                        state = ImeState.StatusMessage("Inserted ✓  — switch back to send.")
                    },
                )
            }
        }

        Spacer(Modifier.height(8.dp))
    }
}

/**
 * Decide what to show when the keyboard appears. Priority:
 *   1. A fresh, un-consumed staged capture (notification / screenshot) within the freshness window.
 *   2. A new clipboard copy.
 *   3. Otherwise leave the current state untouched (don't clobber drafts the user is browsing).
 */
private suspend fun runPickup(
    context: Context,
    scope: CoroutineScope,
    freshClip: () -> Boolean,
    clipText: () -> String?,
    onStateChange: (ImeState) -> Unit,
) {
    val now = System.currentTimeMillis()
    val fresh = withContext(Dispatchers.IO) { CaptureStagingStore.peek(context) }?.takeIf {
        !it.consumed &&
            (it.source == FlynnApi.Source.NOTIFICATION || it.source == FlynnApi.Source.SCREENSHOT) &&
            now - it.capturedAt <= STAGED_FRESH_MS
    }

    if (fresh != null) {
        withContext(Dispatchers.IO) { CaptureStagingStore.markConsumed(context) }
        when {
            fresh.limitReached ->
                onStateChange(ImeState.StatusMessage("You're out of free drafts today — open Flynn to go unlimited."))
            fresh.needsDraft || fresh.drafts.isEmpty() ->
                triggerDraft(context, fresh.messages, fresh.source, fresh.sender, scope, onStateChange)
            else ->
                onStateChange(ImeState.Results(fresh.drafts, 0, fresh.sender, fresh.source, fresh.messages))
        }
        return
    }

    // No fresh staged capture — fall back to a new clipboard copy. Otherwise leave the current
    // state untouched so we don't clobber drafts the user is browsing.
    if (freshClip()) {
        clipText()?.let { clip ->
            triggerDraft(context, listOf(clip), FlynnApi.Source.CLIPBOARD, null, scope, onStateChange)
        }
    }
}

private fun triggerDraft(
    context: Context,
    messages: List<String>,
    source: String,
    sender: String?,
    scope: CoroutineScope,
    onStateChange: (ImeState) -> Unit,
) {
    val token = KeyboardTokenStore.getToken(context)
    if (token == null) {
        onStateChange(ImeState.StatusMessage("Open the Flynn app once to finish setup."))
        return
    }
    if (messages.isEmpty() || messages.all { it.isBlank() }) {
        onStateChange(ImeState.StatusMessage("Nothing to draft yet — copy a message or capture a chat."))
        return
    }
    onStateChange(ImeState.Loading)
    scope.launch(Dispatchers.IO) {
        try {
            val drafts = FlynnApi.fetchDrafts(messages, token, source)
            if (drafts.isEmpty()) {
                onStateChange(ImeState.StatusMessage("Couldn't draft anything — tap ↻ Redraft."))
            } else {
                onStateChange(ImeState.Results(drafts, 0, sender, source, messages))
            }
        } catch (e: FlynnApi.ApiError.LimitReached) {
            onStateChange(ImeState.StatusMessage("You're out of free drafts today — open Flynn to go unlimited."))
        } catch (_: Exception) {
            onStateChange(ImeState.StatusMessage("Network hiccup — tap ↻ Redraft to try again."))
        }
    }
}

@Composable
private fun DraftCard(
    drafts: List<String>,
    index: Int,
    onNext: () -> Unit,
    onPrev: () -> Unit,
    onInsert: (String) -> Unit,
) {
    var dragAccum by remember { mutableStateOf(0f) }

    Column {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(min = 100.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(FlynnCard)
                .clickable { onInsert(drafts[index]) }
                .pointerInput(index, drafts.size) {
                    detectHorizontalDragGestures(
                        onDragEnd = { dragAccum = 0f },
                        onHorizontalDrag = { change, delta ->
                            change.consume()
                            dragAccum += delta
                            if (dragAccum < -40f) { onNext(); dragAccum = 0f }
                            else if (dragAccum > 40f) { onPrev(); dragAccum = 0f }
                        },
                    )
                }
                .padding(14.dp),
        ) {
            Column {
                Text(drafts[index], style = FlynnTypography.bodyLarge, color = FlynnInk)
                Spacer(Modifier.height(8.dp))
                Text("Tap to insert →", style = FlynnTypography.labelSmall, color = FlynnOrange)
            }
        }

        if (drafts.size > 1) {
            Spacer(Modifier.height(4.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextButton(onClick = onPrev, enabled = index > 0) {
                    Text("‹", style = FlynnTypography.headlineLarge,
                        color = if (index > 0) FlynnOrange else FlynnTextTertiary)
                }
                Text(
                    "${index + 1} / ${drafts.size}",
                    style = FlynnTypography.labelMedium,
                    color = FlynnTextSecondary,
                    modifier = Modifier.width(60.dp),
                    textAlign = TextAlign.Center,
                )
                TextButton(onClick = onNext, enabled = index < drafts.lastIndex) {
                    Text("›", style = FlynnTypography.headlineLarge,
                        color = if (index < drafts.lastIndex) FlynnOrange else FlynnTextTertiary)
                }
            }
        }
    }
}

@Composable
private fun StatusText(text: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(80.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, style = FlynnTypography.bodyMedium, color = FlynnTextSecondary,
            textAlign = TextAlign.Center)
    }
}

@Composable
private fun LoadingView() {
    Box(
        modifier = Modifier.fillMaxWidth().height(80.dp),
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            CircularProgressIndicator(color = FlynnOrange, strokeWidth = 2.dp, modifier = Modifier.size(20.dp))
            Spacer(Modifier.width(10.dp))
            Text("Drafting in your voice…", style = FlynnTypography.bodyMedium, color = FlynnTextSecondary)
        }
    }
}
