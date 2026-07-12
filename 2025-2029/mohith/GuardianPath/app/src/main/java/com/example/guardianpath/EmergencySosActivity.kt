package com.example.guardianpath

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.google.android.material.chip.Chip
import com.google.android.material.chip.ChipGroup

class EmergencySosActivity : AppCompatActivity() {

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var tvLocationStatus: TextView
    private lateinit var chipGroupMessage: ChipGroup
    private var currentLocationUrl: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_emergency_sos)

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        toolbar.setNavigationOnClickListener { finish() }

        tvLocationStatus = findViewById(R.id.tvLocationStatus)
        chipGroupMessage = findViewById(R.id.chipGroupMessage)
        
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        fetchLocation()

        val btnBroadcast = findViewById<MaterialButton>(R.id.btnBroadcast)
        btnBroadcast.setOnClickListener {
            broadcastEmergency()
        }
    }

    private fun fetchLocation() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            
            tvLocationStatus.text = "Location Permission Denied"
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                100
            )
            return
        }

        fusedLocationClient.lastLocation.addOnSuccessListener { location ->
            if (location != null) {
                tvLocationStatus.text = "Locked: ${location.latitude}, ${location.longitude}"
                currentLocationUrl = "https://maps.google.com/?q=${location.latitude},${location.longitude}"
            } else {
                tvLocationStatus.text = "Unable to get GPS location. Try outside."
                // Fallback to Nandyal for prototype if GPS is totally unavailable
                currentLocationUrl = "https://maps.google.com/?q=15.4779,78.4836"
            }
        }.addOnFailureListener {
            tvLocationStatus.text = "GPS Fetch Failed"
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 100 && grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            fetchLocation()
        }
    }

    private fun broadcastEmergency() {
        if (currentLocationUrl == null) {
            Toast.makeText(this, "Still acquiring location. Please wait.", Toast.LENGTH_SHORT).show()
            return
        }

        val checkedChipId = chipGroupMessage.checkedChipId
        val emergencyType = if (checkedChipId != -1) {
            findViewById<Chip>(checkedChipId).text.toString()
        } else {
            "General Emergency"
        }

        val message = "URGENT: $emergencyType!\nI need immediate help. Here is my live location:\n$currentLocationUrl"

        // Create an implicit intent to open SMS app with pre-filled message
        val intent = Intent(Intent.ACTION_SENDTO).apply {
            data = Uri.parse("smsto:")  // This ensures only SMS apps respond
            putExtra("sms_body", message)
        }

        try {
            startActivity(intent)
        } catch (e: Exception) {
            // Fallback to general ACTION_SEND if no default SMS app
            val fallbackIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, message)
            }
            startActivity(Intent.createChooser(fallbackIntent, "Share Emergency Location via..."))
        }
    }
}
