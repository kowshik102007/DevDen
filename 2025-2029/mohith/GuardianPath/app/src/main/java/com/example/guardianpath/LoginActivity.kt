package com.example.guardianpath

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText

class LoginActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        toolbar.setNavigationOnClickListener { finish() }

        val btnLogin = findViewById<MaterialButton>(R.id.btnLogin)
        val etEmail = findViewById<TextInputEditText>(R.id.etEmail)
        val etPassword = findViewById<TextInputEditText>(R.id.etPassword)

        btnLogin.setOnClickListener {
            val email = etEmail.text.toString().trim()
            val password = etPassword.text.toString().trim()

            if (email.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Please enter email and password", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // Verify with SharedPreferences
            val sharedPref = getSharedPreferences("GuardianPathPrefs", Context.MODE_PRIVATE)
            val savedEmail = sharedPref.getString("SAVED_EMAIL", null)
            val savedPassword = sharedPref.getString("SAVED_PASSWORD", null)

            if (email == savedEmail && password == savedPassword) {
                // Successful login
                with(sharedPref.edit()) {
                    putBoolean("IS_LOGGED_IN", true)
                    putString("LOGGED_IN_EMAIL", email)
                    apply()
                }
                Toast.makeText(this, "Logged in successfully", Toast.LENGTH_SHORT).show()
                finish()
            } else {
                Toast.makeText(this, "Invalid email or password. Please sign up if you don't have an account.", Toast.LENGTH_LONG).show()
            }
        }

        val tvSignUp = findViewById<TextView>(R.id.tvSignUp)
        tvSignUp.setOnClickListener {
            val intent = Intent(this, SignUpActivity::class.java)
            startActivity(intent)
            finish()
        }
    }
}
