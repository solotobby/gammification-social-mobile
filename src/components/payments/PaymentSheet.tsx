import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { fetchCheckoutOutcome, readCheckoutReturn } from '../../api/levels';
import { useCheckoutStore, type CheckoutSession } from '../../stores/checkoutStore';
import { useFeedbackStore } from '../../stores/feedbackStore';
import { useTheme } from '../../theme/ThemeProvider';
import { FONT } from '../../theme/fonts';

/**
 * How long to keep asking the backend to confirm a charge the provider already
 * said went through. The webhook lands within a second or two when it works;
 * past this the user is told it's still being confirmed rather than being held
 * on a spinner.
 */
const CONFIRM_TIMEOUT = 20_000;
const CONFIRM_INTERVAL = 2_000;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The in-app payment sheet — the provider's hosted checkout inside a WebView we
 * control, mounted once at the root and driven by `checkoutStore`.
 *
 * **Why a WebView and not `expo-web-browser`.** When a charge clears, the
 * provider redirects to the backend's return URL — which it builds from an
 * `APP_URL` still set to `http://localhost`, so the page cannot resolve on a
 * phone. In `SFSafariViewController` that is terminal: the sheet is a black box
 * that reports no navigation, so the app could not tell a completed payment
 * from an abandoned one, and the user was left on "server not found" holding a
 * receipt. A WebView sees every navigation, so the redirect — dead page or not
 * — becomes the signal that the payment is over.
 *
 * The redirect is never *trusted*, only listened to: `readCheckoutReturn` says
 * what the provider claims, and the backend is then asked to confirm it. The
 * two are reported separately, because "Korapay says this went through, we're
 * waiting on Payhankey" is a true and useful thing to say, and "you've been
 * upgraded" — when the account has not been — is not.
 */
export function PaymentSheet() {
  const session = useCheckoutStore((s) => s.session);
  return session ? <PaymentSheetBody session={session} /> : null;
}

/**
 * Split out so every piece of per-payment state — the loading flag, the
 * "handled" latch — is created fresh with the session and thrown away with it.
 */
function PaymentSheetBody({ session }: { session: CheckoutSession }) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const close = useCheckoutStore((s) => s.close);

  const [loading, setLoading] = useState(true);
  /**
   * A return URL can be reported twice — `onShouldStartLoadWithRequest` and
   * then `onNavigationStateChange` — and iOS re-fires both on a redirect chain.
   * Finishing must happen exactly once.
   */
  const handled = useRef(false);

  /**
   * End the payment. `claim` is what the provider's URL said, or `null` when
   * the user closed the sheet themselves.
   */
  const finish = useCallback(
    async (claim: 'success' | 'failed' | 'unknown' | null) => {
      if (handled.current) return;
      handled.current = true;

      const { showToast } = useFeedbackStore.getState();

      // A failure needs no confirming — nothing was charged, and holding the
      // sheet open to prove it would only make the failure feel slower.
      if (claim === 'failed') {
        close();
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        showToast("That payment didn't go through — nothing was charged.", 'error');
        return;
      }

      // Everything else closes the sheet *first*. Confirmation is the backend's
      // to do and can take seconds it may never finish; holding a spinner over
      // a finished payment for that long is worse than handing the app back and
      // reporting when the answer arrives.
      close();
      if (claim === 'success') {
        showToast('Payment received — confirming your upgrade…', 'info');
      }

      let status = await fetchCheckoutOutcome(session.reference, session.levelName);

      // Only a claimed success is worth waiting on. A dismissal is not evidence
      // of payment, so it gets one read and an honest answer.
      if (status === 'pending' && claim === 'success') {
        const deadline = Date.now() + CONFIRM_TIMEOUT;
        while (status === 'pending' && Date.now() < deadline) {
          await delay(CONFIRM_INTERVAL);
          status = await fetchCheckoutOutcome(session.reference, session.levelName);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['levels'] });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });

      if (status === 'success') {
        showToast(`You're on ${session.levelName} now.`, 'success');
      } else if (status === 'failed') {
        showToast("That payment didn't go through — nothing was charged.", 'error');
      } else if (claim === 'success') {
        // The provider handed us a success redirect but the account hasn't
        // moved. Say exactly that — the money is not in question, the upgrade
        // is, and inventing either answer would be worse than naming the gap.
        showToast(
          "Payment received. We're still waiting on Payhankey to confirm the upgrade.",
          'info',
        );
      } else {
        showToast(
          "We haven't seen that payment yet. Your level updates as soon as it clears.",
          'info',
        );
      }
    },
    [close, queryClient, session.levelName, session.reference],
  );

  /**
   * Gate every navigation. Returning false on the return URL means the dead
   * `localhost` page is never even requested — the sheet closes straight off
   * the redirect instead of flashing an error first.
   */
  const onShouldStart = useCallback(
    (request: { url: string }) => {
      const { isReturn, outcome } = readCheckoutReturn(request.url);
      if (!isReturn) return true;
      void finish(outcome);
      return false;
    },
    [finish],
  );

  /**
   * Belt and braces: a redirect the load gate doesn't see (a server-side 302
   * chain, or `window.location` from the page's own script) still surfaces
   * here, and `finish` is latched so the two can't both act.
   */
  const onNavigationStateChange = useCallback(
    (state: WebViewNavigation) => {
      // The backend's return URL is undocumented — this is how its real shape
      // gets read, and how a change to it gets noticed before users hit it.
      if (__DEV__) console.log('[checkout] →', state.url);
      const { isReturn, outcome } = readCheckoutReturn(state.url);
      if (isReturn) void finish(outcome);
    },
    [finish],
  );

  return (
    <Modal
      visible
      animationType="slide"
      // Full screen, not a page sheet: a payment gets the whole display, and an
      // iOS card could be swiped away mid-3-D-Secure by a stray gesture. The
      // explicit Cancel button is the only way out.
      presentationStyle="fullScreen"
      onRequestClose={() => void finish(null)}
      // Belt and braces if the modal is ever dismissed by the system: without
      // this the store would keep a session for a sheet that is off screen.
      onDismiss={() => void finish(null)}
    >
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + spacing.sm, borderBottomColor: colors.border },
          ]}
        >
          <Pressable
            onPress={() => void finish(null)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Cancel payment"
            style={[styles.close, { backgroundColor: colors.surfaceAlt }]}
          >
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>Secure payment</Text>
            <View style={styles.lockRow}>
              <Ionicons name="lock-closed" size={11} color={colors.textMuted} />
              <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {session.levelName} · handled by our payment provider
              </Text>
            </View>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.body}>
          <WebView
            source={{ uri: session.url }}
            onShouldStartLoadWithRequest={onShouldStart}
            onNavigationStateChange={onNavigationStateChange}
            onLoadEnd={() => setLoading(false)}
            onError={() => setLoading(false)}
            // The hosted page opens bank and 3-D Secure steps in the same view;
            // without this they silently do nothing.
            setSupportMultipleWindows={false}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            startInLoadingState={false}
            style={{ backgroundColor: colors.background }}
          />

          {loading ? (
            <View style={[styles.overlay, { backgroundColor: colors.background }]}>
              <ActivityIndicator color={colors.brand} />
              <Text style={[styles.overlayText, { color: colors.textMuted }]}>
                Opening secure checkout…
              </Text>
            </View>
          ) : null}
        </View>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + spacing.md,
              borderTopColor: colors.border,
              backgroundColor: colors.surface,
            },
          ]}
        >
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Payhankey never sees your card details.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, alignItems: 'center', gap: 2 },
  title: { fontFamily: FONT, fontSize: 16, fontWeight: '700' },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  subtitle: { fontFamily: FONT, fontSize: 11.5 },
  body: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  overlayText: { fontFamily: FONT, fontSize: 13.5 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: { fontFamily: FONT, fontSize: 12 },
});
