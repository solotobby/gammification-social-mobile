package expo.modules.calllockscreen

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener
import java.lang.ref.WeakReference

/**
 * Puts the activity over the lock screen the moment an incoming call's
 * full-screen intent creates it, and hands the module that activity.
 *
 * Neither can wait for JS. React Native only learns of an activity once it
 * resumes, and one started behind the lock screen never resumes — and until it
 * does, `Linking.getInitialURL()` doesn't settle, so expo-router renders
 * nothing and no JS could ask for the flag. From a cold start the call stayed
 * hidden behind the lock screen until the phone was unlocked.
 *
 * The call is recognised by the notification notify-kit puts on the launch
 * intent (`fullScreenAction.mainComponent`, see src/calls/callNotifications.ts):
 * its id is `call-<id>`. JS clears the flag again if the launch doesn't end in
 * a call on screen (useCallNotifications) and when the call ends (CallHost).
 */
class CallLockScreenPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context?): List<ReactActivityLifecycleListener> =
    listOf(ActivityTracker)
}

internal object ActivityTracker : ReactActivityLifecycleListener {
  private var ref: WeakReference<Activity>? = null

  val activity: Activity?
    get() = ref?.get()

  override fun onCreate(activity: Activity?, savedInstanceState: Bundle?) {
    ref = activity?.let { WeakReference(it) }
    if (activity != null && isCallLaunch(activity.intent)) showOverLockScreen(activity, true)
  }

  override fun onNewIntent(intent: Intent?): Boolean {
    val current = activity
    if (current != null && isCallLaunch(intent)) showOverLockScreen(current, true)
    return false
  }

  override fun onDestroy(activity: Activity?) {
    if (ref?.get() === activity) ref = null
  }

  private fun isCallLaunch(intent: Intent?): Boolean =
    intent?.getBundleExtra("notification")?.getString("id")?.startsWith("call-") == true
}

/** Show the activity over the lock screen and wake the screen — or stop. */
internal fun showOverLockScreen(activity: Activity, enabled: Boolean) {
  activity.runOnUiThread {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      activity.setShowWhenLocked(enabled)
      activity.setTurnScreenOn(enabled)
    } else {
      @Suppress("DEPRECATION")
      val flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      if (enabled) {
        activity.window.addFlags(flags)
      } else {
        activity.window.clearFlags(flags)
      }
    }
  }
}
