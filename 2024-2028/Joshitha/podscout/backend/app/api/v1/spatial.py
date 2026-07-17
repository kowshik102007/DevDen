"""
Spatial Grid API Endpoints

Endpoints for grid generation and feature aggregation.
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from ...spatial.grid_generator import grid_generator
from ...spatial.feature_aggregator import feature_aggregator

router = APIRouter(prefix="/spatial", tags=["spatial"])


class GridGenerationRequest(BaseModel):
    """Request to generate grid for a city"""
    city: str
    bbox: List[float]  # [min_lon, min_lat, max_lon, max_lat]


class GridGenerationResponse(BaseModel):
    """Response from grid generation"""
    status: str
    city: str
    cells_generated: int
    cells_stored: int
    levels: dict


@router.post("/grid/generate", response_model=GridGenerationResponse)
async def generate_grid(request: GridGenerationRequest):
    """
    Generate adaptive spatial grid for a city.
    
    Creates multi-resolution grid cells based on population density:
    - Urban: 500m × 500m
    - Suburban: 1km × 1km
    - Rural: 2km × 2km
    """
    try:
        result = await grid_generator.generate_city_grid(
            city=request.city,
            bbox=request.bbox
        )
        
        return GridGenerationResponse(
            status="completed",
            city=result["city"],
            cells_generated=result["cells_generated"],
            cells_stored=result["cells_stored"],
            levels=result["levels"]
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/grid/generate/major-cities")
async def generate_grids_for_major_cities(background_tasks: BackgroundTasks):
    """
    Generate grids for all major Indian cities in background.
    
    Cities: Delhi, Mumbai, Bangalore, Chennai, Kolkata
    """
    cities = {
        'Delhi': [77.0, 28.4, 77.4, 28.9],
        'Mumbai': [72.7, 18.9, 72.9, 19.3],
        'Bangalore': [77.4, 12.8, 77.8, 13.1],
        'Chennai': [80.1, 12.9, 80.3, 13.2],
        'Kolkata': [88.2, 22.4, 88.5, 22.7]
    }
    
    async def generate_all():
        for city, bbox in cities.items():
            try:
                result = await grid_generator.generate_city_grid(city, bbox)
                print(f"Generated grid for {city}: {result}")
            except Exception as e:
                print(f"Error generating grid for {city}: {e}")
    
    background_tasks.add_task(generate_all)
    
    return {
        "status": "started",
        "message": "Generating grids for major cities in background",
        "cities": list(cities.keys()),
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/features/aggregate")
async def aggregate_features(city: Optional[str] = None):
    """
    Aggregate features for all grid cells.
    
    Combines data from:
    - Monitoring sites within cells
    - Satellite data
    - Temporal rolling features
    - Spatial context
    
    Args:
        city: Optional city name to filter cells
    """
    try:
        result = await feature_aggregator.aggregate_all_cells(city)
        
        return {
            "status": "completed",
            "result": result,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/grid/stats")
async def get_grid_stats(city: Optional[str] = None):
    """
    Get grid statistics.
    
    Returns:
        Count of cells by level and city
    """
    from ...services.supabase import get_supabase
    
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    try:
        # Query cells
        query = supabase.table("grid_cells").select("grid_level, city")
        if city:
            query = query.eq("city", city)
        
        result = query.execute()
        cells = result.data
        
        # Aggregate stats
        stats = {
            "total_cells": len(cells),
            "by_level": {
                "urban": len([c for c in cells if c["grid_level"] == 1]),
                "suburban": len([c for c in cells if c["grid_level"] == 2]),
                "rural": len([c for c in cells if c["grid_level"] == 3])
            },
            "by_city": {}
        }
        
        # Count by city
        for cell in cells:
            city_name = cell["city"]
            if city_name not in stats["by_city"]:
                stats["by_city"][city_name] = 0
            stats["by_city"][city_name] += 1
        
        return stats
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/grid/cells")
async def get_cells(
    city: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    """
    Get grid cells with features.
    
    Args:
        city: Optional city filter
        limit: Maximum results
        offset: Pagination offset
    """
    from ...services.supabase import get_supabase
    
    supabase = get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database not configured")
    
    try:
        query = supabase.table("grid_cells").select("*")
        
        if city:
            query = query.eq("city", city)
        
        query = query.order("gnn_node_id").range(offset, offset + limit - 1)
        
        result = query.execute()
        
        return {
            "cells": result.data,
            "count": len(result.data),
            "offset": offset,
            "limit": limit
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
