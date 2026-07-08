# Add project specific ProGuard rules here.
-keepattributes *Annotation*
-keep class org.tensorflow.** { *; }
-dontwarn org.tensorflow.**