package com.example.guardianpath

import android.content.Context
import android.os.Bundle
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText

class SignUpActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_sign_up)

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        toolbar.setNavigationOnClickListener { finish() }

        val etName = findViewById<TextInputEditText>(R.id.etName)
        val etEmail = findViewById<TextInputEditText>(R.id.etEmail)
        val etPassword = findViewById<TextInputEditText>(R.id.etPassword)
        val etConfirmPassword = findViewById<TextInputEditText>(R.id.etConfirmPassword)
        val btnSignUp = findViewById<MaterialButton>(R.id.btnSignUp)

        btnSignUp.setOnClickListener {
            val name = etName.text.toString().trim()
            val email = etEmail.text.toString().trim()
            val password = etPassword.text.toString().trim()
            val confirmPassword = etConfirmPassword.text.toString().trim()

            if (name.isEmpty() || email.isEmpty() || password.isEmpty()) {
                Toast.makeText(this, "Please fill all fields", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            if (password != confirmPassword) {
                Toast.makeText(this, "Passwords do not match", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // Save user credentials (Mocking a database with SharedPreferences)
            val sharedPref = getSharedPreferences("GuardianPathPrefs", Context.MODE_PRIVATE)
            with(sharedPref.edit()) {
                putString("SAVED_EMAIL", email)
                putString("SAVED_PASSWORD", password)
                putString("USER_NAME", name)
                
                // Automatically log them in after sign up
                putBoolean("IS_LOGGED_IN", true)
                putString("LOGGED_IN_EMAIL", email)
                apply()
            }

            Toast.makeText(this, "Account created successfully!", Toast.LENGTH_SHORT).show()
            finish() // Return to the previous screen (Settings/Login)
        }

        val tvLogin = findViewById<TextView>(R.id.tvLogin)
        tvLogin.setOnClickListener {
            finish() // Just go back to the login screen
        }
    }
}
