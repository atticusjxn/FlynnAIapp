package com.flynnai.app.feature.bookings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.flynnai.app.FlynnApp
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable

@Serializable
data class JobDTO(
    val id: String,
    val client_name: String? = null,
    val service_type: String? = null,
    val status: String? = null,
    val scheduled_date: String? = null,
    val scheduled_time: String? = null,
    val location: String? = null,
    val notes: String? = null,
    val created_at: String? = null,
)

sealed interface BookingsState {
    data object Loading : BookingsState
    data object Loaded : BookingsState
    data class Error(val msg: String) : BookingsState
}

class BookingsViewModel : ViewModel() {
    private val client = FlynnApp.instance.supabase

    private val _state = MutableStateFlow<BookingsState>(BookingsState.Loading)
    val state = _state.asStateFlow()

    val upcoming = MutableStateFlow<List<JobDTO>>(emptyList())
    val past = MutableStateFlow<List<JobDTO>>(emptyList())

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = BookingsState.Loading
            try {
                val uid = client.auth.currentSessionOrNull()?.user?.id?.toString() ?: return@launch
                val jobs: List<JobDTO> = client.postgrest.from("jobs")
                    .select { filter { eq("user_id", uid) }; order("scheduled_date", Order.DESCENDING); limit(100) }
                    .decodeList()
                val today = java.time.LocalDate.now().toString()
                upcoming.value = jobs.filter { it.status != "complete" && (it.scheduled_date == null || it.scheduled_date >= today) }
                past.value = jobs.filter { it.status == "complete" || (it.scheduled_date != null && it.scheduled_date < today) }
                _state.value = BookingsState.Loaded
            } catch (e: Exception) {
                _state.value = BookingsState.Error(e.message ?: "Load failed")
            }
        }
    }
}
