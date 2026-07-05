package com.example.guardianpath

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.switchmaterial.SwitchMaterial

class SettingsActivity : AppCompatActivity() {

    private var isLoggedIn = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        toolbar.setNavigationOnClickListener { finish() }

        val switchTheme = findViewById<SwitchMaterial>(R.id.switchTheme)
        
        // Initialize switch based on current theme
        switchTheme.isChecked = AppCompatDelegate.getDefaultNightMode() == AppCompatDelegate.MODE_NIGHT_YES
        
        switchTheme.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
            } else {
                AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO)
            }
        }

        val layoutBookmarks = findViewById<LinearLayout>(R.id.layoutBookmarks)
        layoutBookmarks.setOnClickListener {
            val intent = Intent(this, BookmarksActivity::class.java)
            startActivity(intent)
        }

        val layoutAuth = findViewById<LinearLayout>(R.id.layoutAuth)
        val tvAuthAction = findViewById<TextView>(R.id.tvAuthAction)
        layoutAuth.setOnClickListener {
            if (!isLoggedIn) {
                // Launch Login Activity
                val intent = Intent(this, LoginActivity::class.java)
                startActivity(intent)
            } else {
                // Logout logic
                val sharedPref = getSharedPreferences("GuardianPathPrefs", Context.MODE_PRIVATE)
                with(sharedPref.edit()) {
                    putBoolean("IS_LOGGED_IN", false)
                    remove("LOGGED_IN_EMAIL")
                    apply()
                }
                updateAuthUI()
                Toast.makeText(this, "Logged out", Toast.LENGTH_SHORT).show()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        updateAuthUI()
    }

    private fun updateAuthUI() {
        val sharedPref = getSharedPreferences("GuardianPathPrefs", Context.MODE_PRIVATE)
        isLoggedIn = sharedPref.getBoolean("IS_LOGGED_IN", false)
        val email = sharedPref.getString("LOGGED_IN_EMAIL", "")

        val tvAuthAction = findViewById<TextView>(R.id.tvAuthAction)
        val tvAuthStatus = findViewById<TextView>(R.id.tvAuthStatus)

        if (isLoggedIn) {
            tvAuthAction.text = "Logout"
            tvAuthStatus.text = "Logged in as $email"
        } else {
            tvAuthAction.text = "Login / Sign Up"
            tvAuthStatus.text = "Not logged in"
        }
    }
}
