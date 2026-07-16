"""
Enhanced Redis caching service for PodScout Pro.

Provides:
- Async Redis client support
- Caching decorators
- Cache key management
- TTL-based expiration
- JSON serialization for complex objects
"""
import redis
import redis.asyncio as aioredis
import json
import logging
import hashlib
import functools
from typing import Optional, Any, Callable, Union
from datetime import timedelta
from ..config import settings

logger = logging.getLogger(__name__)


class RedisClient:
    """Enhanced Redis client with caching capabilities."""
    
    _sync_instance: Optional[redis.Redis] = None
    _async_instance: Optional[aioredis.Redis] = None
    _connected: bool = False
    
    # Cache key prefixes for different data types
    PREFIXES = {
        'openaq': 'oaq:',
        'cpcb': 'cpcb:',
        'osm': 'osm:',
        'sentinel': 'sat:',
        'grid': 'grid:',
        'analysis': 'ana:',
        'general': 'gen:'
    }
    
    # Default TTLs (in seconds)
    DEFAULT_TTLS = {
        'openaq': 300,      # 5 minutes for real-time AQ data
        'cpcb': 300,        # 5 minutes for real-time AQ data
        'osm': 86400,       # 24 hours for location data
        'sentinel': 3600,   # 1 hour for satellite data
        'grid': 1800,       # 30 minutes for grid features
        'analysis': 600,    # 10 minutes for analysis results
        'general': 300      # 5 minutes default
    }
    
    @classmethod
    def get_client(cls) -> Optional[redis.Redis]:
        """Get or create Redis client instance."""
        if cls._sync_instance is None:
            try:
                redis_url = settings.REDIS_URL
                if not redis_url:
                    logger.warning("REDIS_URL not configured")
                    return None
                
                cls._sync_instance = redis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_timeout=5.0,
                    socket_connect_timeout=5.0
                )
                
                # Test connection
                cls._sync_instance.ping()
                cls._connected = True
                logger.info("✅ Redis connected successfully")
                
            except redis.ConnectionError as e:
                logger.error(f"❌ Redis connection failed: {e}")
                cls._sync_instance = None
                cls._connected = False
            except Exception as e:
                logger.error(f"❌ Redis error: {e}")
                cls._sync_instance = None
                cls._connected = False
                
        return cls._sync_instance
    
    @classmethod
    def is_connected(cls) -> bool:
        """Check if Redis is connected and accessible."""
        if not cls._connected or cls._sync_instance is None:
            return False
        try:
            cls._sync_instance.ping()
            return True
        except Exception:
            cls._connected = False
            return False
    
    @classmethod
    def health_check(cls) -> dict:
        """Comprehensive Redis health check."""
        try:
            client = cls.get_client()
            if not client:
                return {
                    'status': 'disconnected',
                    'error': 'No Redis connection'
                }
            
            # Ping test
            client.ping()
            
            # Get server info
            info = client.info('server')
            memory = client.info('memory')
            
            return {
                'status': 'healthy',
                'redis_version': info.get('redis_version', 'unknown'),
                'used_memory_human': memory.get('used_memory_human', 'unknown'),
                'connected_clients': client.info('clients').get('connected_clients', 0)
            }
            
        except redis.ConnectionError as e:
            return {'status': 'disconnected', 'error': str(e)}
        except Exception as e:
            return {'status': 'error', 'error': str(e)}
    
    @classmethod
    def generate_key(cls, prefix: str, *args, **kwargs) -> str:
        """
        Generate a cache key from prefix and arguments.
        
        Args:
            prefix: Key prefix category (e.g., 'openaq', 'osm')
            *args: Positional arguments to include in key
            **kwargs: Keyword arguments to include in key
        
        Returns:
            Formatted cache key
        """
        prefix_str = cls.PREFIXES.get(prefix, cls.PREFIXES['general'])
        
        # Create deterministic string from args
        key_parts = [str(arg) for arg in args]
        key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()) if v is not None)
        
        key_data = ':'.join(key_parts)
        
        # Hash if key is too long — sha256 is collision-resistant unlike MD5
        if len(key_data) > 100:
            key_hash = hashlib.sha256(key_data.encode()).hexdigest()[:16]
            return f"{prefix_str}{key_hash}"
        
        return f"{prefix_str}{key_data}"
    
    @classmethod
    def get(cls, key: str) -> Optional[Any]:
        """
        Get value from cache.
        
        Args:
            key: Cache key
        
        Returns:
            Cached value or None
        """
        client = cls.get_client()
        if not client:
            return None
        
        try:
            value = client.get(key)
            if value:
                return json.loads(value)
            return None
        except json.JSONDecodeError:
            return value
        except Exception as e:
            logger.error(f"Redis GET error: {e}")
            return None
    
    @classmethod
    def set(
        cls,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        prefix: str = 'general'
    ) -> bool:
        """
        Set value in cache.
        
        Args:
            key: Cache key
            value: Value to cache (will be JSON serialized)
            ttl: Time-to-live in seconds (uses default if not specified)
            prefix: Prefix category for default TTL
        
        Returns:
            True if successful
        """
        client = cls.get_client()
        if not client:
            return False
        
        try:
            if ttl is None:
                ttl = cls.DEFAULT_TTLS.get(prefix, cls.DEFAULT_TTLS['general'])
            
            serialized = json.dumps(value)
            client.setex(key, ttl, serialized)
            return True
            
        except Exception as e:
            logger.error(f"Redis SET error: {e}")
            return False
    
    @classmethod
    def delete(cls, key: str) -> bool:
        """Delete a key from cache."""
        client = cls.get_client()
        if not client:
            return False
        
        try:
            client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Redis DELETE error: {e}")
            return False
    
    @classmethod
    def delete_pattern(cls, pattern: str) -> int:
        """
        Delete all keys matching a pattern.
        
        Args:
            pattern: Redis key pattern (e.g., 'oaq:*')
        
        Returns:
            Number of keys deleted
        """
        client = cls.get_client()
        if not client:
            return 0
        
        try:
            keys = client.keys(pattern)
            if keys:
                return client.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Redis DELETE PATTERN error: {e}")
            return 0
    
    @classmethod
    def invalidate_cache(cls, prefix: str) -> int:
        """
        Invalidate all cache for a specific data source.
        
        Args:
            prefix: Data source prefix (e.g., 'openaq', 'osm')
        
        Returns:
            Number of keys deleted
        """
        prefix_str = cls.PREFIXES.get(prefix, '')
        if prefix_str:
            return cls.delete_pattern(f"{prefix_str}*")
        return 0
    
    @classmethod
    def get_cache_stats(cls) -> dict:
        """Get cache statistics."""
        client = cls.get_client()
        if not client:
            return {'error': 'Not connected'}
        
        try:
            stats = {}
            for name, prefix in cls.PREFIXES.items():
                keys = client.keys(f"{prefix}*")
                stats[name] = len(keys)
            
            stats['total'] = sum(stats.values())
            return stats
            
        except Exception as e:
            return {'error': str(e)}

    # ------------------------------------------------------------------
    # Async interface
    # ------------------------------------------------------------------

    @classmethod
    async def get_async_client(cls) -> Optional[aioredis.Redis]:
        """Get (or lazily create) the async Redis client."""
        if cls._async_instance is None:
            redis_url = settings.REDIS_URL
            if not redis_url:
                logger.warning("REDIS_URL not configured — async Redis unavailable")
                return None
            try:
                cls._async_instance = aioredis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_timeout=5.0,
                    socket_connect_timeout=5.0,
                )
                await cls._async_instance.ping()
                logger.info("✅ Async Redis connected")
            except Exception as e:
                logger.error("❌ Async Redis connection failed: %s", e)
                cls._async_instance = None
        return cls._async_instance

    @classmethod
    async def async_get(cls, key: str) -> Optional[Any]:
        """Async cache read."""
        client = await cls.get_async_client()
        if not client:
            return None
        try:
            value = await client.get(key)
            if value:
                return json.loads(value)
            return None
        except json.JSONDecodeError:
            return value
        except Exception as e:
            logger.error("Async Redis GET error: %s", e)
            return None

    @classmethod
    async def async_set(
        cls,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        prefix: str = 'general',
    ) -> bool:
        """Async cache write."""
        client = await cls.get_async_client()
        if not client:
            return False
        try:
            if ttl is None:
                ttl = cls.DEFAULT_TTLS.get(prefix, cls.DEFAULT_TTLS['general'])
            await client.setex(key, ttl, json.dumps(value))
            return True
        except Exception as e:
            logger.error("Async Redis SET error: %s", e)
            return False

    @classmethod
    async def async_delete(cls, key: str) -> bool:
        """Async cache delete."""
        client = await cls.get_async_client()
        if not client:
            return False
        try:
            await client.delete(key)
            return True
        except Exception as e:
            logger.error("Async Redis DELETE error: %s", e)
            return False


def cached(
    prefix: str = 'general',
    ttl: Optional[int] = None,
    key_builder: Optional[Callable] = None
):
    """
    Decorator to cache function results in Redis.
    
    Args:
        prefix: Cache key prefix category
        ttl: Custom TTL in seconds
        key_builder: Optional function to build cache key from args
    
    Usage:
        @cached(prefix='openaq', ttl=300)
        async def fetch_data(city: str):
            ...
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            # Build cache key
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                cache_key = RedisClient.generate_key(prefix, func.__name__, *args, **kwargs)
            
            # Try to get from cache
            cached_value = RedisClient.get(cache_key)
            if cached_value is not None:
                logger.debug(f"Cache HIT: {cache_key}")
                return cached_value
            
            logger.debug(f"Cache MISS: {cache_key}")
            
            # Call function
            result = await func(*args, **kwargs)
            
            # Cache result if not empty
            if result:
                RedisClient.set(cache_key, result, ttl=ttl, prefix=prefix)
            
            return result
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            # Build cache key
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                cache_key = RedisClient.generate_key(prefix, func.__name__, *args, **kwargs)
            
            # Try to get from cache
            cached_value = RedisClient.get(cache_key)
            if cached_value is not None:
                logger.debug(f"Cache HIT: {cache_key}")
                return cached_value
            
            logger.debug(f"Cache MISS: {cache_key}")
            
            # Call function
            result = func(*args, **kwargs)
            
            # Cache result if not empty
            if result:
                RedisClient.set(cache_key, result, ttl=ttl, prefix=prefix)
            
            return result
        
        # Return appropriate wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    
    return decorator


# Convenience functions
def get_redis() -> Optional[redis.Redis]:
    """Get Redis client instance."""
    return RedisClient.get_client()


def cache_get(key: str) -> Optional[Any]:
    """Get value from cache."""
    return RedisClient.get(key)


def cache_set(key: str, value: Any, ttl: int = 300) -> bool:
    """Set value in cache."""
    return RedisClient.set(key, value, ttl=ttl)
