package com.example.guardianpath

import android.content.Context
import android.os.Bundle
import android.util.TypedValue
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.card.MaterialCardView

class BookmarksActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_bookmarks)

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        toolbar.setNavigationOnClickListener { finish() }

        loadBookmarks()
    }

    private fun loadBookmarks() {
        val container = findViewById<LinearLayout>(R.id.layoutBookmarksContainer)
        val tvNoBookmarks = findViewById<TextView>(R.id.tvNoBookmarks)
        val sharedPref = getSharedPreferences("GuardianPathBookmarks", Context.MODE_PRIVATE)
        val bookmarks = sharedPref.getStringSet("BOOKMARKS", emptySet()) ?: emptySet()

        if (bookmarks.isEmpty()) {
            tvNoBookmarks.visibility = View.VISIBLE
            return
        }

        tvNoBookmarks.visibility = View.GONE

        for (bookmark in bookmarks) {
            val parts = bookmark.split("|")
            if (parts.size >= 4) {
                val title = parts[0]
                val subtitle = parts[1]
                val lat = parts[2]
                val lng = parts[3]

                val card = MaterialCardView(this).apply {
                    layoutParams = LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.WRAP_CONTENT
                    ).apply {
                        setMargins(0, 0, 0, dpToPx(16))
                    }
                    radius = dpToPx(16).toFloat()
                    cardElevation = dpToPx(2).toFloat()
                    setCardBackgroundColor(ContextCompat.getColor(this@BookmarksActivity, R.color.surfaceColor))
                    strokeWidth = 0
                }

                val linearLayout = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    setPadding(dpToPx(16), dpToPx(16), dpToPx(16), dpToPx(16))
                    gravity = android.view.Gravity.CENTER_VERTICAL
                }

                val icon = ImageView(this).apply {
                    setImageResource(R.drawable.ic_my_location)
                    setColorFilter(ContextCompat.getColor(this@BookmarksActivity, R.color.primaryColor))
                    layoutParams = LinearLayout.LayoutParams(dpToPx(24), dpToPx(24))
                }

                val textLayout = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                        marginStart = dpToPx(16)
                    }
                }

                val tvTitle = TextView(this).apply {
                    text = title
                    textSize = 18f
                    setTextColor(ContextCompat.getColor(this@BookmarksActivity, R.color.textColorPrimary))
                    setTypeface(null, android.graphics.Typeface.BOLD)
                }

                val tvSubtitle = TextView(this).apply {
                    val latFormatted = String.format("%.4f", lat.toDoubleOrNull() ?: 0.0)
                    val lngFormatted = String.format("%.4f", lng.toDoubleOrNull() ?: 0.0)
                    text = "$subtitle\nLat: $latFormatted, Lng: $lngFormatted"
                    textSize = 14f
                    setTextColor(ContextCompat.getColor(this@BookmarksActivity, R.color.textColorSecondary))
                    setPadding(0, dpToPx(4), 0, 0)
                }

                textLayout.addView(tvTitle)
                textLayout.addView(tvSubtitle)
                
                linearLayout.addView(icon)
                linearLayout.addView(textLayout)
                card.addView(linearLayout)
                
                container.addView(card)
            }
        }
    }

    private fun dpToPx(dp: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp.toFloat(),
            resources.displayMetrics
        ).toInt()
    }
}
