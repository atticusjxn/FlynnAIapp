package com.flynnai.app.nav

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.RecordVoiceOver
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.flynnai.app.feature.bookings.BookingsScreen
import com.flynnai.app.feature.brain.BrainScreen
import com.flynnai.app.feature.home.HomeScreen
import com.flynnai.app.feature.settings.AccountScreen
import com.flynnai.app.feature.settings.SettingsScreen
import com.flynnai.app.feature.voice.VoiceScreen
import com.flynnai.app.ui.onboarding.ob.OB
import com.flynnai.app.ui.theme.FlynnOrange
import com.flynnai.app.ui.theme.FlynnTypography
import kotlinx.coroutines.launch

sealed class Tab(val route: String, val label: String, val icon: ImageVector) {
    data object Home : Tab("home", "Home", Icons.Default.Home)
    data object Voice : Tab("voice", "Voice", Icons.Default.RecordVoiceOver)
    data object Brain : Tab("brain", "Brain", Icons.Default.Psychology)
    data object Bookings : Tab("bookings", "Bookings", Icons.Default.CalendarMonth)
}

private val tabs = listOf(Tab.Home, Tab.Voice, Tab.Brain, Tab.Bookings)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainTabView() {
    val navController = rememberNavController()
    val backStack by navController.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    var showSettings by remember { mutableStateOf(false) }
    var showAccount by remember { mutableStateOf(false) }
    var showCapture by remember { mutableStateOf(false) }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet {
                DrawerContent(
                    onSettings = { showSettings = true },
                    onAccount = { showAccount = true },
                    onClose = { scope.launch { drawerState.close() } },
                )
            }
        },
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = { Text("Flynn", style = FlynnTypography.headlineMedium) },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Default.Menu, contentDescription = "Menu")
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = OB.card),
                )
            },
            bottomBar = {
                NavigationBar(containerColor = OB.card) {
                    tabs.forEach { tab ->
                        NavigationBarItem(
                            selected = currentRoute == tab.route,
                            onClick = {
                                navController.navigate(tab.route) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true; restoreState = true
                                }
                            },
                            icon = { Icon(tab.icon, tab.label) },
                            label = { Text(tab.label, style = FlynnTypography.labelSmall) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = FlynnOrange,
                                selectedTextColor = FlynnOrange,
                                indicatorColor = FlynnOrange.copy(alpha = 0.12f),
                            ),
                        )
                    }
                }
            },
        ) { paddingValues ->
            if (showCapture) {
                com.flynnai.app.feature.settings.CaptureSetupScreen(
                    modifier = Modifier.padding(paddingValues),
                    onBack = { showCapture = false },
                )
                return@Scaffold
            }
            if (showSettings) {
                SettingsScreen(
                    modifier = Modifier.padding(paddingValues),
                    onNavigateToCapture = { showCapture = true },
                )
                return@Scaffold
            }
            if (showAccount) {
                AccountScreen(
                    modifier = Modifier.padding(paddingValues),
                    onSignedOut = { showAccount = false },
                    onBack = { showAccount = false },
                )
                return@Scaffold
            }
            NavHost(navController, startDestination = Tab.Home.route, modifier = Modifier.padding(paddingValues)) {
                composable(Tab.Home.route) { HomeScreen() }
                composable(Tab.Voice.route) { VoiceScreen() }
                composable(Tab.Brain.route) { BrainScreen() }
                composable(Tab.Bookings.route) { BookingsScreen() }
            }
        }
    }
}
