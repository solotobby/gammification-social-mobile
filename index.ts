// App entry. The call background handlers must be registered before anything
// else: Android can start this bundle with no screen at all — to deliver an
// incoming-call push or a tap on a call notification's Decline — and only
// what's imported here is guaranteed to have run. See src/calls/backgroundCalls.ts.
import './src/calls/backgroundCalls';
import 'expo-router/entry';
