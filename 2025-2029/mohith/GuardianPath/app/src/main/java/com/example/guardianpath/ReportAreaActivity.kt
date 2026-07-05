package com.example.guardianpath

import android.Manifest
import android.content.pm.PackageManager
import android.location.Address
import android.location.Geocoder
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.Toast
import java.io.IOException
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import com.google.android.gms.location.LocationServices
import com.google.android.material.appbar.MaterialToolbar
import com.google.android.material.button.MaterialButton
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.OnMapReadyCallback
import com.google.android.gms.maps.SupportMapFragment
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.Marker
import com.google.android.gms.maps.model.MarkerOptions

class ReportAreaActivity : AppCompatActivity(), OnMapReadyCallback {

    private lateinit var map: GoogleMap
    private var selectedLocation: LatLng? = null
    private var currentMarker: Marker? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_report_area)

        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        toolbar.setNavigationOnClickListener { finish() }

        val mapFragment = supportFragmentManager
            .findFragmentById(R.id.mapView) as SupportMapFragment
        mapFragment.getMapAsync(this)

        setupSearchBar()

        val btnSubmit = findViewById<MaterialButton>(R.id.btnSubmitReport)
        btnSubmit.setOnClickListener {
            if (selectedLocation == null) {
                Toast.makeText(this, "Please select a location on the map first", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "Report submitted successfully!", Toast.LENGTH_LONG).show()
                finish()
            }
        }

        val btnSubmitSms = findViewById<MaterialButton>(R.id.btnSubmitSms)
        btnSubmitSms.setOnClickListener {
            if (selectedLocation == null) {
                Toast.makeText(this, "Please select a location on the map first", Toast.LENGTH_SHORT).show()
            } else {
                val message = "Hazard Reported at Location: https://maps.google.com/?q=${selectedLocation!!.latitude},${selectedLocation!!.longitude}"
                val intent = Intent(Intent.ACTION_SENDTO).apply {
                    data = Uri.parse("smsto:")  // This ensures only SMS apps respond
                    putExtra("sms_body", message)
                }
                startActivity(intent)
            }
        }
    }

    override fun onMapReady(googleMap: GoogleMap) {
        map = googleMap
        
        map.setOnMapClickListener { latLng ->
            pinLocation(latLng)
        }

        val fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            fusedLocationClient.lastLocation.addOnSuccessListener { location ->
                location?.let {
                    val currentPoint = LatLng(it.latitude, it.longitude)
                    map.moveCamera(CameraUpdateFactory.newLatLngZoom(currentPoint, 18f))
                    pinLocation(currentPoint)
                } ?: setDefaultLocation()
            }
        } else {
            setDefaultLocation()
        }
    }

    private fun setupSearchBar() {
        val etSearch = findViewById<EditText>(R.id.etReportSearch)
        etSearch.setOnEditorActionListener { v, actionId, event ->
            if (actionId == EditorInfo.IME_ACTION_SEARCH) {
                val locationName = etSearch.text.toString()
                if (locationName.isNotEmpty()) {
                    searchLocation(locationName)
                }
                true
            } else {
                false
            }
        }
    }

    private fun searchLocation(locationName: String) {
        if (!::map.isInitialized) return
        val geocoder = Geocoder(this)
        try {
            val addressList: List<Address>? = geocoder.getFromLocationName(locationName, 1)
            if (!addressList.isNullOrEmpty()) {
                val address = addressList[0]
                val destPoint = LatLng(address.latitude, address.longitude)
                
                map.animateCamera(CameraUpdateFactory.newLatLngZoom(destPoint, 16f))
                pinLocation(destPoint)
            } else {
                Toast.makeText(this, "Location not found", Toast.LENGTH_SHORT).show()
            }
        } catch (e: IOException) {
            Toast.makeText(this, "Search failed. Check internet connection.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun pinLocation(p: LatLng) {
        selectedLocation = p
        currentMarker?.remove()
        
        currentMarker = map.addMarker(MarkerOptions()
            .position(p)
            .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_RED))
        )
    }

    private fun setDefaultLocation() {
        if (!::map.isInitialized) return
        val startPoint = LatLng(15.4779, 78.4836)
        map.moveCamera(CameraUpdateFactory.newLatLngZoom(startPoint, 15f))
    }
}
