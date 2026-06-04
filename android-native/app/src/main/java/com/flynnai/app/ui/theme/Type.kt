package com.flynnai.app.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.flynnai.app.R

val SpaceGrotesk = FontFamily(
    Font(R.font.space_grotesk_semibold, FontWeight.SemiBold),
    Font(R.font.space_grotesk_bold, FontWeight.Bold),
)

val Inter = FontFamily(
    Font(R.font.inter_regular, FontWeight.Normal),
    Font(R.font.inter_medium, FontWeight.Medium),
)

val FlynnTypography = Typography(
    displayLarge = TextStyle(fontFamily = SpaceGrotesk, fontWeight = FontWeight.Bold, fontSize = 32.sp, lineHeight = 40.sp),
    displayMedium = TextStyle(fontFamily = SpaceGrotesk, fontWeight = FontWeight.Bold, fontSize = 28.sp, lineHeight = 36.sp),
    headlineLarge = TextStyle(fontFamily = SpaceGrotesk, fontWeight = FontWeight.Bold, fontSize = 24.sp, lineHeight = 32.sp),
    headlineMedium = TextStyle(fontFamily = SpaceGrotesk, fontWeight = FontWeight.SemiBold, fontSize = 20.sp, lineHeight = 28.sp),
    headlineSmall = TextStyle(fontFamily = SpaceGrotesk, fontWeight = FontWeight.SemiBold, fontSize = 18.sp, lineHeight = 24.sp),
    titleLarge = TextStyle(fontFamily = SpaceGrotesk, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 22.sp),
    bodyLarge = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Normal, fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Normal, fontSize = 14.sp, lineHeight = 20.sp),
    bodySmall = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 16.sp),
    labelLarge = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 20.sp),
    labelMedium = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 16.sp),
    labelSmall = TextStyle(fontFamily = Inter, fontWeight = FontWeight.Medium, fontSize = 11.sp, lineHeight = 14.sp),
)
