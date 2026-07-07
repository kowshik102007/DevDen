package com.example.guardianpath

import android.location.Location
import com.google.android.gms.maps.model.LatLng
import java.util.Calendar

object SafetyEngine {

    const val DANGER_ZONE_RADIUS_METERS = 200.0

    val dangerZones = listOf(
        LatLng(15.4800, 78.4850), // Nandyala Zone 1
        LatLng(15.4750, 78.4800), // Nandyala Zone 2
        LatLng(15.4820, 78.4880), // Nandyala Zone 3
        LatLng(15.4900, 78.4950), // Nandyala Zone 4
        LatLng(15.4650, 78.4700), // Nandyala Zone 5
        LatLng(15.8281, 78.0373), // Kurnool Zone 1
        LatLng(15.8350, 78.0450), // Kurnool Zone 2
        LatLng(15.8150, 78.0200), // Kurnool Zone 3
        LatLng(17.3850, 78.4867), // Hyderabad Zone 1
        LatLng(17.3950, 78.4967), // Hyderabad Zone 2
        LatLng(17.3750, 78.4767), // Hyderabad Zone 3
        LatLng(17.4050, 78.5067)  // Hyderabad Zone 4
    )

    fun isLocationInDangerZone(location: Location): Boolean {
        for (zone in dangerZones) {
            val results = FloatArray(1)
            Location.distanceBetween(location.latitude, location.longitude, zone.latitude, zone.longitude, results)
            val distance = results[0].toDouble()
            if (distance <= DANGER_ZONE_RADIUS_METERS) {
                return true
            }
        }
        return false
    }

    fun isNightTime(): Boolean {
        val calendar = Calendar.getInstance()
        val hour = calendar.get(Calendar.HOUR_OF_DAY)
        // Night is considered from 19:00 (7 PM) to 06:00 (6 AM)
        return hour >= 19 || hour <= 6
    }

    fun calculateRouteDangerScore(route: List<LatLng>): Double {
        var score = 0.0
        for (point in route) {
            for (zone in dangerZones) {
                val results = FloatArray(1)
                Location.distanceBetween(point.latitude, point.longitude, zone.latitude, zone.longitude, results)
                val distance = results[0].toDouble()
                if (distance <= DANGER_ZONE_RADIUS_METERS) {
                    score += 100.0 
                } else if (distance <= DANGER_ZONE_RADIUS_METERS * 2) {
                    score += 10.0  
                }
            }
        }
        
        // Multiplier for night time safety
        if (isNightTime()) {
            score *= 5.0
        }
        
        return score
    }

    fun getDangerPointsOnRoute(route: List<LatLng>): List<LatLng> {
        val riskyZones = mutableSetOf<LatLng>()
        for (point in route) {
            for (zone in dangerZones) {
                val results = FloatArray(1)
                Location.distanceBetween(point.latitude, point.longitude, zone.latitude, zone.longitude, results)
                val distance = results[0].toDouble()
                if (distance <= DANGER_ZONE_RADIUS_METERS * 1.5) {
                    riskyZones.add(zone)
                }
            }
        }
        return riskyZones.toList()
    }
}
