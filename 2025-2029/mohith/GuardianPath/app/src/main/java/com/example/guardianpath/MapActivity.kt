package com.example.guardianpath

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Color
import android.location.Address
import android.location.Geocoder
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import com.google.android.gms.location.*
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.floatingactionbutton.FloatingActionButton
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.OnMapReadyCallback
import com.google.android.gms.maps.SupportMapFragment
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.Marker
import com.google.android.gms.maps.model.MarkerOptions
import java.io.IOException

class MapActivity : AppCompatActivity(), OnMapReadyCallback {

    private lateinit var map: GoogleMap
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private var isAlertShowing = false
    private var userMarker: Marker? = null
    private var destinationMarker: Marker? = null
    private var currentGeoPoint: LatLng? = null
    private var destinationLocation: LatLng? = null
    private var isNavigationStarted = false
    private lateinit var bottomSheetBehavior: BottomSheetBehavior<View>
    private val riskCircles = mutableListOf<com.google.android.gms.maps.model.Circle>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_map)

        val mapFragment = supportFragmentManager
            .findFragmentById(R.id.map) as SupportMapFragment
        mapFragment.getMapAsync(this)

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                for (location in locationResult.locations) {
                    currentGeoPoint = LatLng(location.latitude, location.longitude)
                    if (::map.isInitialized) {
                        updateUserMarker(currentGeoPoint!!)
                        
                        if (isNavigationStarted) {
                            val builder = com.google.android.gms.maps.model.CameraPosition.Builder()
                                .target(currentGeoPoint!!)
                                .zoom(19f)
                                .tilt(60f)
                            if (location.hasBearing()) {
                                builder.bearing(location.bearing)
                            }
                            map.animateCamera(CameraUpdateFactory.newCameraPosition(builder.build()))
                        }
                    }

                    if (SafetyEngine.isLocationInDangerZone(location)) {
                        triggerEmergencyAlert()
                    }
                }
            }
        }

        setupSearchBar()
        setupMyLocationFab()
        setupCityInfoCard()
    }

    override fun onMapReady(googleMap: GoogleMap) {
        map = googleMap
        
        requestLocationPermissions()
    }

    private fun setupSearchBar() {
        val etSearch = findViewById<EditText>(R.id.etSearch)
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

    private fun setupMyLocationFab() {
        val fabMyLocation = findViewById<FloatingActionButton>(R.id.fabMyLocation)
        fabMyLocation.setOnClickListener {
            if (!::map.isInitialized) return@setOnClickListener
            currentGeoPoint?.let {
                map.animateCamera(CameraUpdateFactory.newLatLngZoom(it, 18f))
            } ?: Toast.makeText(this, "Location not found yet.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun setupCityInfoCard() {
        val bottomSheet = findViewById<View>(R.id.bottomSheet)
        bottomSheetBehavior = BottomSheetBehavior.from(bottomSheet)
        bottomSheetBehavior.state = BottomSheetBehavior.STATE_HIDDEN

        val btnClose = findViewById<android.widget.ImageView>(R.id.btnCloseCityInfo)
        btnClose.setOnClickListener {
            bottomSheetBehavior.state = BottomSheetBehavior.STATE_HIDDEN
            isNavigationStarted = false // Stop navigation if closed
            map.animateCamera(CameraUpdateFactory.newCameraPosition(
                com.google.android.gms.maps.model.CameraPosition.Builder()
                    .target(currentGeoPoint ?: LatLng(15.4779, 78.4836))
                    .zoom(15f)
                    .tilt(0f)
                    .build()
            ))
        }

        val btnDirections = findViewById<com.google.android.material.button.MaterialButton>(R.id.btnDirections)
        val btnStart = findViewById<com.google.android.material.button.MaterialButton>(R.id.btnStart)
        val btnAgentInfo = findViewById<com.google.android.material.button.MaterialButton>(R.id.btnAgentInfo)

        btnAgentInfo.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("🛡️ Agent Intelligence")
                .setMessage("Guardian Path's Agent evaluates all possible alternative routes in real-time.\n\n" +
                        "Unlike standard maps that only prioritize the shortest time, our Agent prioritizes your SAFETY.\n\n" +
                        "If the primary route passes through a high-risk area or a danger zone (especially at night), the Agent will automatically divert you to a safer alternative, even if it adds a few minutes to your journey.")
                .setPositiveButton("I Understand") { dialog, _ -> dialog.dismiss() }
                .show()
        }

        btnDirections.setOnClickListener {
            if (currentGeoPoint != null && destinationLocation != null) {
                val bounds = com.google.android.gms.maps.model.LatLngBounds.Builder()
                    .include(currentGeoPoint!!)
                    .include(destinationLocation!!)
                    .build()
                map.animateCamera(CameraUpdateFactory.newLatLngBounds(bounds, 150))
            } else {
                Toast.makeText(this, "Location or Destination missing.", Toast.LENGTH_SHORT).show()
            }
        }

        btnStart.setOnClickListener {
            if (currentGeoPoint != null && destinationLocation != null) {
                isNavigationStarted = true
                bottomSheetBehavior.state = BottomSheetBehavior.STATE_HIDDEN
                Toast.makeText(this, "Navigation Started", Toast.LENGTH_SHORT).show()
                
                val cameraPosition = com.google.android.gms.maps.model.CameraPosition.Builder()
                    .target(currentGeoPoint!!)
                    .zoom(19f)
                    .tilt(60f)
                    .build()
                map.animateCamera(CameraUpdateFactory.newCameraPosition(cameraPosition))
            } else {
                Toast.makeText(this, "Location or Destination missing.", Toast.LENGTH_SHORT).show()
            }
        }

        val btnSave = findViewById<com.google.android.material.button.MaterialButton>(R.id.btnSave)
        btnSave.setOnClickListener {
            val tvCityTitle = findViewById<TextView>(R.id.tvCityTitle).text.toString()
            val tvCitySubtitle = findViewById<TextView>(R.id.tvCitySubtitle).text.toString()
            if (destinationLocation != null) {
                val sharedPref = getSharedPreferences("GuardianPathBookmarks", android.content.Context.MODE_PRIVATE)
                val existing = sharedPref.getStringSet("BOOKMARKS", mutableSetOf())?.toMutableSet() ?: mutableSetOf()
                val bookmarkEntry = "$tvCityTitle|$tvCitySubtitle|${destinationLocation!!.latitude}|${destinationLocation!!.longitude}"
                existing.add(bookmarkEntry)
                sharedPref.edit().putStringSet("BOOKMARKS", existing).apply()
                Toast.makeText(this, "Location saved to Bookmarks!", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "No location to save.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun fetchCityInfo(cityName: String, subtitle: String = "Location Details") {
        val tvCityTitle = findViewById<TextView>(R.id.tvCityTitle)
        val tvCitySubtitle = findViewById<TextView>(R.id.tvCitySubtitle)
        val tvCityDescription = findViewById<TextView>(R.id.tvCityDescription)

        bottomSheetBehavior.state = BottomSheetBehavior.STATE_COLLAPSED
        tvCityTitle.text = cityName
        tvCitySubtitle.text = "Fetching details..."
        tvCityDescription.text = "Fetching information..."

        val url = "https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro&explaintext&redirects=1&titles=${cityName.replace(" ", "%20")}"
        
        val request = okhttp3.Request.Builder().url(url).build()
        okhttp3.OkHttpClient().newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                Handler(Looper.getMainLooper()).post {
                    tvCitySubtitle.text = subtitle
                    tvCityDescription.text = "Failed to load information."
                }
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                response.body?.string()?.let { jsonString ->
                    try {
                        val jsonObject = org.json.JSONObject(jsonString)
                        val queryObj = jsonObject.optJSONObject("query")
                        val pages = queryObj?.optJSONObject("pages")
                        
                        if (pages == null) {
                            Handler(Looper.getMainLooper()).post {
                                tvCitySubtitle.text = subtitle
                                tvCityDescription.text = "No Wikipedia information found for this location."
                            }
                            return
                        }

                        val firstPageKey = pages.keys().next()
                        
                        if (firstPageKey == "-1") {
                            Handler(Looper.getMainLooper()).post {
                                tvCitySubtitle.text = subtitle
                                tvCityDescription.text = "No Wikipedia information found for this location."
                            }
                            return
                        }
                        
                        val extract = pages.getJSONObject(firstPageKey).optString("extract", "No description available.")
                        
                        Handler(Looper.getMainLooper()).post {
                            tvCitySubtitle.text = subtitle
                            tvCityDescription.text = extract.ifEmpty { "No description available." }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                        Handler(Looper.getMainLooper()).post {
                            tvCitySubtitle.text = subtitle
                            tvCityDescription.text = "Information unavailable."
                        }
                    }
                }
            }
        })
    }

    private fun searchLocation(locationName: String) {
        if (!::map.isInitialized) return
        if (currentGeoPoint == null) {
            Toast.makeText(this, "Waiting for your GPS location...", Toast.LENGTH_SHORT).show()
            return
        }

        val geocoder = Geocoder(this)
        try {
            val addressList: List<Address>? = geocoder.getFromLocationName(locationName, 1)
            if (!addressList.isNullOrEmpty()) {
                val address = addressList[0]
                val destPoint = LatLng(address.latitude, address.longitude)
                destinationLocation = destPoint
                
                map.animateCamera(CameraUpdateFactory.newLatLngZoom(destPoint, 15f))

                if (destinationMarker == null) {
                    destinationMarker = map.addMarker(MarkerOptions()
                        .position(destPoint)
                        .title(address.getAddressLine(0))
                    )
                } else {
                    destinationMarker?.position = destPoint
                }

                // Auto fetch route and calculate stats
                val layoutRouteStats = findViewById<View>(R.id.layoutRouteStats)
                val tvRouteStatus = findViewById<TextView>(R.id.tvRouteStatus)
                layoutRouteStats.visibility = View.VISIBLE
                tvRouteStatus.text = "Status: Calculating safe route..."
                tvRouteStatus.setTextColor(android.graphics.Color.parseColor("#E65100")) // Orange
                
                RouteManager.drawSafestRoute(map, currentGeoPoint!!, destinationLocation!!) { routeInfo ->
                    updateRouteUI(routeInfo)
                }
                
                val citySearchTerm = address.locality ?: address.subAdminArea ?: locationName
                val subtitleInfo = address.adminArea ?: address.countryName ?: "Location Details"
                fetchCityInfo(citySearchTerm, subtitleInfo)
                
            } else {
                Toast.makeText(this, "Location not found", Toast.LENGTH_SHORT).show()
            }
        } catch (e: IOException) {
            Toast.makeText(this, "Search failed. Check internet connection.", Toast.LENGTH_SHORT).show()
        }
    }

    private fun requestLocationPermissions() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
                100
            )
        } else {
            startLocationUpdates()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 100 && grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            startLocationUpdates()
        }
    }

    private fun startLocationUpdates() {
        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000).build()
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper())
            
            fusedLocationClient.lastLocation.addOnSuccessListener { location ->
                location?.let {
                    currentGeoPoint = LatLng(it.latitude, it.longitude)
                    if (::map.isInitialized) {
                        map.moveCamera(CameraUpdateFactory.newLatLngZoom(currentGeoPoint!!, 16f))
                        updateUserMarker(currentGeoPoint!!)
                    }
                } ?: run {
                    if (::map.isInitialized) {
                        val defaultPoint = LatLng(15.4779, 78.4836)
                        map.moveCamera(CameraUpdateFactory.newLatLngZoom(defaultPoint, 15f))
                    }
                }
            }
        }
    }

    private fun updateUserMarker(point: LatLng) {
        if (userMarker == null) {
            userMarker = map.addMarker(MarkerOptions().position(point).title("You are here"))
        } else {
            userMarker?.position = point
        }
    }

    private fun drawDangerZones() {
        // No longer used for static drawing
    }

    private fun clearRiskCircles() {
        for (circle in riskCircles) {
            circle.remove()
        }
        riskCircles.clear()
    }

    private fun drawRiskZonesOnRoute(points: List<LatLng>) {
        clearRiskCircles()
        val dangerPoints = SafetyEngine.getDangerPointsOnRoute(points)
        for (point in dangerPoints) {
            val circle = map.addCircle(com.google.android.gms.maps.model.CircleOptions()
                .center(point)
                .radius(SafetyEngine.DANGER_ZONE_RADIUS_METERS * 1.5)
                .strokeColor(Color.RED)
                .strokeWidth(3f)
                .fillColor(Color.argb(60, 255, 0, 0)) // 60 alpha red
            )
            riskCircles.add(circle)
        }
    }

    private fun triggerEmergencyAlert() {
        if (isAlertShowing) return
        isAlertShowing = true

        AlertDialog.Builder(this)
            .setTitle("⚠️ DANGER DETECTED")
            .setMessage("You have entered a known unsafe area! Emergency contacts have been automatically notified.")
            .setCancelable(false)
            .setIcon(android.R.drawable.ic_dialog_alert)
            .setPositiveButton("I AM SAFE") { dialog, _ ->
                isAlertShowing = false
                dialog.dismiss()
            }
            .setNegativeButton("CALL POLICE") { dialog, _ ->
                Toast.makeText(this, "Simulating Call to Police...", Toast.LENGTH_SHORT).show()
                isAlertShowing = false
                dialog.dismiss()
            }
            .show()
    }

    private fun updateRouteUI(routeInfo: RouteInfo) {
        val tvRouteStatus = findViewById<TextView>(R.id.tvRouteStatus)
        val tvRouteDistance = findViewById<TextView>(R.id.tvRouteDistance)
        val tvRouteEta = findViewById<TextView>(R.id.tvRouteEta)

        val distanceKm = routeInfo.distanceMeters / 1000.0
        tvRouteDistance.text = String.format("Distance: %.1f km", distanceKm)

        val drivingMins = (routeInfo.durationSeconds / 60).toInt()
        val cyclingMins = ((distanceKm / 15.0) * 60).toInt()
        val walkingMins = ((distanceKm / 5.0) * 60).toInt()
        
        fun formatTime(mins: Int): String {
            if (mins < 60) return "$mins mins"
            val h = mins / 60
            val m = mins % 60
            return "${h}h ${m}m"
        }

        tvRouteEta.text = "ETA - Driving: ${formatTime(drivingMins)} | Cycling: ${formatTime(cyclingMins)} | Walking: ${formatTime(walkingMins)}"

        tvRouteStatus.text = "Status: ${routeInfo.agentMessage}"
        if (routeInfo.dangerScore > 0) {
            tvRouteStatus.setTextColor(android.graphics.Color.RED)
            drawRiskZonesOnRoute(routeInfo.routePoints)
        } else {
            tvRouteStatus.setTextColor(android.graphics.Color.parseColor("#4CAF50")) // Green
            clearRiskCircles()
        }
    }

    override fun onPause() {
        super.onPause()
        fusedLocationClient.removeLocationUpdates(locationCallback)
    }
}