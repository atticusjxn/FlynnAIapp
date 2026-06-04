package com.flynnai.app.keyboard

import android.content.ClipboardManager
import android.content.Context
import android.inputmethodservice.InputMethodService
import android.view.View
import android.view.inputmethod.InputConnection
import android.widget.FrameLayout
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
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
import com.flynnai.app.data.api.FlynnApi
import com.flynnai.app.ui.components.Mascot
import com.flynnai.app.ui.components.MascotPose
import com.flynnai.app.ui.theme.FlynnBackground
import com.flynnai.app.ui.theme.FlynnCard
import com.flynnai.app.ui.theme.FlynnInk
import com.flynnai.app.ui.theme.FlynnOrange
import com.flynnai.app.ui.theme.FlynnTextSecondary
import com.flynnai.app.ui.theme.FlynnTextTertiary
import com.flynnai.app.ui.theme.FlynnTheme
import com.flynnai.app.ui.theme.FlynnTypography
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class FlynnImeService : InputMethodService(), LifecycleOwner, SavedStateRegistryOwner {

    // Lifecycle boilerplate needed for Compose inside an IME service
    private val lifecycleRegistry = LifecycleRegistry(this)
    override val lifecycle: Lifecycle get() = lifecycleRegistry

    private val savedStateRegistryController = SavedStateRegistryController.create(this)
    override val savedStateRegistry: SavedStateRegistry get() = savedStateRegistryController.savedStateRegistry

    private var lastClipHash: Int = -1

    override fun onCreate() {
        super.onCreate()
        savedStateRegistryController.performRestore(null)
        lifecycleRegistry.currentState = Lifecycle.State.CREATED
    }

    override fun onStartInput(attribute: android.view.inputmethod.EditorInfo?, restarting: Boolean) {
        super.onStartInput(attribute, restarting)
        lifecycleRegistry.currentState = Lifecycle.State.RESUMED
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
                        onInsert = { text ->
                            currentInputConnection?.commitText(text, 1)
                            // Record accepted draft (fire and forget)
                            val token = KeyboardTokenStore.getToken(this@FlynnImeService) ?: return@ImeContent
                            FlynnApi.recordAccepted(text, token)
                        },
                        onSwitchKeyboard = { switchToNextInputMethod(false) },
                        shouldAutoTrigger = { freshClip() },
                        getClipText = { clipText() },
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
// UI
// ─────────────────────────────────────────────────────────

private sealed interface ImeState {
    data object Idle : ImeState
    data object Loading : ImeState
    data class Results(val drafts: List<String>, val index: Int) : ImeState
    data class StatusMessage(val text: String) : ImeState
}

@Composable
private fun ImeContent(
    context: Context,
    onInsert: (String) -> Unit,
    onSwitchKeyboard: () -> Unit,
    shouldAutoTrigger: () -> Boolean,
    getClipText: () -> String?,
) {
    var state by remember { mutableStateOf<ImeState>(ImeState.Idle) }
    val scope = rememberCoroutineScope()

    // Auto-draft on appear when clipboard is new
    androidx.compose.runtime.LaunchedEffect(Unit) {
        if (shouldAutoTrigger()) {
            triggerDraft(context, getClipText, onStateChange = { state = it }, scope)
        }
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
            val businessName = KeyboardTokenStore.getBusinessName(context)
            Text(
                text = if (businessName != null) "Flynn · $businessName" else "Flynn",
                style = FlynnTypography.labelMedium,
                color = FlynnTextSecondary,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = {
                    state = ImeState.Loading
                    triggerDraft(context, getClipText, onStateChange = { state = it }, scope)
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

        // Content area
        AnimatedContent(
            targetState = state,
            transitionSpec = { fadeIn() togetherWith fadeOut() },
            label = "imeContent",
        ) { s ->
            when (s) {
                is ImeState.Idle -> StatusText("Copy a message, then tap ↻ Redraft.")
                is ImeState.Loading -> LoadingView()
                is ImeState.StatusMessage -> StatusText(s.text)
                is ImeState.Results -> DraftCard(
                    drafts = s.drafts,
                    index = s.index,
                    onNext = { state = s.copy(index = (s.index + 1).coerceAtMost(s.drafts.lastIndex)) },
                    onPrev = { state = s.copy(index = (s.index - 1).coerceAtLeast(0)) },
                    onInsert = { text ->
                        onInsert(text)
                        state = ImeState.StatusMessage("Inserted ✓  — switch back to send.")
                    },
                )
            }
        }

        Spacer(Modifier.height(8.dp))
    }
}

private fun triggerDraft(
    context: Context,
    getClipText: () -> String?,
    onStateChange: (ImeState) -> Unit,
    scope: kotlinx.coroutines.CoroutineScope,
) {
    val token = KeyboardTokenStore.getToken(context)
    if (token == null) {
        onStateChange(ImeState.StatusMessage("Open the Flynn app once to finish setup."))
        return
    }
    val text = getClipText()
    if (text == null) {
        onStateChange(ImeState.StatusMessage("Copy a message first, then tap ↻ Redraft."))
        return
    }
    onStateChange(ImeState.Loading)
    scope.launch(Dispatchers.IO) {
        try {
            val drafts = FlynnApi.fetchDrafts(listOf(text), token)
            if (drafts.isEmpty()) {
                onStateChange(ImeState.StatusMessage("Couldn't draft anything — tap ↻ Redraft."))
            } else {
                onStateChange(ImeState.Results(drafts, 0))
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
        // Swipeable card
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

        // Pager (hidden if only 1 draft)
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
