package com.example.guardianpath

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.card.MaterialCardView

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val startBtn = findViewById<MaterialCardView>(R.id.cardStart)
        val reportBtn = findViewById<MaterialCardView>(R.id.cardReport)

        startBtn.setOnClickListener {
            val intent = Intent(this, MapActivity::class.java)
            startActivity(intent)
        }

        reportBtn.setOnClickListener {
            val intent = Intent(this, ReportAreaActivity::class.java)
            startActivity(intent)
        }

        val emergencyBtn = findViewById<com.google.android.material.button.MaterialButton>(R.id.btnEmergency)
        emergencyBtn.setOnClickListener {
            val intent = Intent(this, EmergencySosActivity::class.java)
            startActivity(intent)
        }

        val settingsBtn = findViewById<android.widget.ImageView>(R.id.btnSettings)
        settingsBtn.setOnClickListener {
            val intent = Intent(this, SettingsActivity::class.java)
            startActivity(intent)
        }
    }
}