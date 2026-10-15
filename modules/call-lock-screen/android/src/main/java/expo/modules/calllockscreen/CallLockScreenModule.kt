package expo.modules.calllockscreen

import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * What a calling app needs from the window and the system that React Native
 * doesn't expose:
 *
 * - Show the app over the lock screen (and wake the screen) — but only while a
 *   call is ringing or in progress. Setting `showWhenLocked` in the manifest
 *   instead would put Payhankey on top of the lock screen whenever it was open
 *   when the phone locked, so it is switched on and off at runtime.
 * - Android 14+ full-screen-intent access, which decides whether an incoming
 *   call can take over the screen, and the settings page that grants it.
 */
class CallLockScreenModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CallLockScreen")

    Function("setShowOverLockScreen") { enabled: Boolean ->
      // Not yet resumed when a call's full-screen intent started it behind
      // the lock screen — see CallLockScreenPackage.
      val activity = appContext.currentActivity ?: ActivityTracker.activity ?: return@Function false
      showOverLockScreen(activity, enabled)
      true
    }

    Function("isDeviceLocked") {
      val context = appContext.reactContext ?: return@Function false
      val keyguard = context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
      keyguard?.isKeyguardLocked ?: false
    }

    Function("canUseFullScreenIntent") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return@Function true
      val context = appContext.reactContext ?: return@Function true
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
      manager?.canUseFullScreenIntent() ?: true
    }

    Function("openFullScreenIntentSettings") {
      val context = appContext.reactContext ?: return@Function false
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${context.packageName}"))
      } else {
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
          .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      true
    }
  }
}
