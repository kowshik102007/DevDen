package com.example.guardianpath

import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.util.Log
import okhttp3.*
import org.json.JSONObject
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.Polyline
import com.google.android.gms.maps.model.PolylineOptions
import java.io.IOException

data class RouteInfo(
    val distanceMeters: Double,
    val durationSeconds: Double,
    val dangerScore: Double,
    val agentMessage: String,
    val routePoints: List<LatLng>
)

object RouteManager {

    private var currentRoute: Polyline? = null
    private val client = OkHttpClient()

    fun drawSafestRoute(map: GoogleMap, startPoint: LatLng, endPoint: LatLng, onAgentResult: ((RouteInfo) -> Unit)? = null) {
        currentRoute?.remove()

        val url = "https://router.project-osrm.org/route/v1/driving/${startPoint.longitude},${startPoint.latitude};${endPoint.longitude},${endPoint.latitude}?overview=full&geometries=geojson&alternatives=true"

        val request = Request.Builder()
            .url(url)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("RouteManager", "Failed to fetch route from OSRM", e)
            }

            override fun onResponse(call: Call, response: Response) {
                response.body?.string()?.let { jsonString ->
                    try {
                        val jsonObject = JSONObject(jsonString)
                        val routes = jsonObject.optJSONArray("routes")
                        
                        if (routes != null && routes.length() > 0) {
                            var bestRoutePoints: List<LatLng>? = null
                            var lowestDangerScore = Double.MAX_VALUE
                            var shortestDuration = Double.MAX_VALUE
                            var bestDistance = 0.0
                            var routeIndexChosen = 0
                            
                            for (i in 0 until routes.length()) {
                                val routeObj = routes.getJSONObject(i)
                                val duration = routeObj.optDouble("duration", Double.MAX_VALUE)
                                val distance = routeObj.optDouble("distance", 0.0)
                                
                                val geometry = routeObj.getJSONObject("geometry")
                                val coordinates = geometry.getJSONArray("coordinates")

                                val latLngs = mutableListOf<LatLng>()
                                for (j in 0 until coordinates.length()) {
                                    val coord = coordinates.getJSONArray(j)
                                    val lon = coord.getDouble(0)
                                    val lat = coord.getDouble(1)
                                    latLngs.add(LatLng(lat, lon))
                                }
                                
                                val score = SafetyEngine.calculateRouteDangerScore(latLngs)
                                
                                if (score < lowestDangerScore) {
                                    lowestDangerScore = score
                                    shortestDuration = duration
                                    bestDistance = distance
                                    bestRoutePoints = latLngs
                                    routeIndexChosen = i
                                } else if (score == lowestDangerScore && duration < shortestDuration) {
                                    shortestDuration = duration
                                    bestDistance = distance
                                    bestRoutePoints = latLngs
                                    routeIndexChosen = i
                                }
                            }

                            if (bestRoutePoints != null) {
                                Handler(Looper.getMainLooper()).post {
                                    val polylineOptions = PolylineOptions()
                                        .addAll(bestRoutePoints)
                                        .color(Color.parseColor("#1E88E5"))
                                        .width(12f)
                                    
                                    currentRoute = map.addPolyline(polylineOptions)
                                    
                                    val isNight = SafetyEngine.isNightTime()
                                    var agentMessage = "Fastest route selected."
                                    if (lowestDangerScore > 0) {
                                        agentMessage = "Safest possible route selected, but proceed with caution."
                                    } else if (routeIndexChosen > 0) {
                                        agentMessage = if (isNight) {
                                            "Agent: Safer alternative route selected avoiding danger zones."
                                        } else {
                                            "Agent: Safest alternative route selected avoiding danger zones."
                                        }
                                    } else if (isNight) {
                                        agentMessage = "Agent: Primary route is safe and fast."
                                    }
                                    
                                    val routeInfo = RouteInfo(
                                        distanceMeters = bestDistance,
                                        durationSeconds = shortestDuration,
                                        dangerScore = lowestDangerScore,
                                        agentMessage = agentMessage,
                                        routePoints = bestRoutePoints
                                    )
                                    onAgentResult?.invoke(routeInfo)
                                }
                            }
                        }
                    } catch (e: Exception) {
                        Log.e("RouteManager", "Failed to parse route JSON", e)
                    }
                }
            }
        })
    }
}
