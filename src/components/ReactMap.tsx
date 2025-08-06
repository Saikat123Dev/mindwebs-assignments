import * as L from 'leaflet';
import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { MapContainer, Polygon, TileLayer, Tooltip } from 'react-leaflet';
import { AppContext } from '../store/context';
import { fetchTemperature } from '../utils/fetchWeather';
import LeafletDrawControl from './LeafLetDrawControl';

const ReactMap = () => {
  const { polygons, updatePolygon, setThresholdRules, thresholdRules, evaluateThresholds, timeRange } = useContext(AppContext);
  const fetchingRef = useRef(false);

  useEffect(() => {
    setThresholdRules([
      { operator: '<', value: 10, color: '#ff0000' },
      { operator: '>=', value: 10, color: '#0000ff' },
      { operator: '>=', value: 25, color: '#00ff00' },
    ]);
  }, [setThresholdRules]);

  // Calculate polygon area in square kilometers
  const calculatePolygonArea = useCallback((polygonPoints) => {
    if (!polygonPoints || polygonPoints.length < 3) return 0;
    
    try {
      const leafletPolygon = L.polygon(polygonPoints);
      const bounds = leafletPolygon.getBounds();
      
      // Approximate area calculation using bounds (rough estimate)
      const latDiff = bounds.getNorth() - bounds.getSouth();
      const lngDiff = bounds.getEast() - bounds.getWest();
      
      // Convert to approximate km² (very rough estimation)
      // 1 degree ≈ 111 km at equator, varies by latitude
      const avgLat = (bounds.getNorth() + bounds.getSouth()) / 2;
      const latToKm = 111; // km per degree latitude
      const lngToKm = 111 * Math.cos(avgLat * Math.PI / 180); // km per degree longitude at this latitude
      
      const areaKm2 = (latDiff * latToKm) * (lngDiff * lngToKm);
      return Math.max(areaKm2, 0.1); // Minimum 0.1 km²
    } catch (error) {
      console.error('Error calculating polygon area:', error);
      return 1; // Default to 1 km²
    }
  }, []);

  // Dynamic grid size calculation based on area
  const calculateOptimalGridSize = useCallback((areaKm2) => {
    // Define sampling density based on area size
    let gridSize;
    
    if (areaKm2 <= 1) {
      // Very small areas: 2x2 grid (4 points)
      gridSize = 2;
    } else if (areaKm2 <= 10) {
      // Small areas: 3x3 grid (9 points)
      gridSize = 3;
    } else if (areaKm2 <= 50) {
      // Medium areas: 4x4 grid (16 points)
      gridSize = 4;
    } else if (areaKm2 <= 200) {
      // Large areas: 5x5 grid (25 points)
      gridSize = 5;
    } else if (areaKm2 <= 500) {
      // Very large areas: 6x6 grid (36 points)
      gridSize = 6;
    } else {
      // Extremely large areas: 7x7 grid (49 points) - but consider hierarchical sampling
      gridSize = 7;
    }

    // Alternative dynamic approach: target ~1 point per 2-5 km²
    const targetDensity = 0.3; // points per km²
    const calculatedSize = Math.sqrt(areaKm2 * targetDensity);
    const dynamicSize = Math.max(2, Math.min(8, Math.ceil(calculatedSize)));
    
    // Use whichever gives more reasonable sampling
    return Math.max(gridSize, dynamicSize);
  }, []);

  // Optimized point-in-polygon check
  const isPointInPolygon = useCallback((point, polygonPoints) => {
    if (!point || !polygonPoints || polygonPoints.length < 3) return false;
    
    const [x, y] = point;
    let inside = false;
    
    try {
      for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
        const [xi, yi] = polygonPoints[i];
        const [xj, yj] = polygonPoints[j];
        
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
          inside = !inside;
        }
      }
    } catch (error) {
      console.error('Error in point-in-polygon calculation:', error);
      return false;
    }
    
    return inside;
  }, []);

  // Enhanced grid generation with dynamic sizing and better distribution
  const generateGridPoints = useCallback((polygon) => {
    if (!polygon || !polygon.points || polygon.points.length < 3) {
      console.warn('Invalid polygon data for grid generation');
      return [];
    }

    try {
      const leafletPolygon = L.polygon(polygon.points);
      const bounds = leafletPolygon.getBounds();
      
      // Calculate area and optimal grid size
      const areaKm2 = calculatePolygonArea(polygon.points);
      const gridSize = calculateOptimalGridSize(areaKm2);
      
      console.log(`Polygon ${polygon.id}: Area ~${areaKm2.toFixed(2)} km², Grid: ${gridSize}x${gridSize} (${gridSize * gridSize} points)`);
      
      const points = [];
      
      const latStep = (bounds.getNorth() - bounds.getSouth()) / gridSize;
      const lngStep = (bounds.getEast() - bounds.getWest()) / gridSize;
      
      // Ensure we have valid step sizes
      if (latStep <= 0 || lngStep <= 0) {
        console.warn('Invalid polygon bounds for grid generation');
        const center = bounds.getCenter();
        return [{ lat: center.lat, lng: center.lng }];
      }
      
      // Generate grid points with better distribution
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          // Use different offset strategies for better coverage
          let latOffset, lngOffset;
          
          if (gridSize <= 3) {
            // For small grids, use center points
            latOffset = 0.5;
            lngOffset = 0.5;
          } else {
            // For larger grids, use slight randomization for better distribution
            latOffset = 0.3 + Math.random() * 0.4; // Random between 0.3-0.7
            lngOffset = 0.3 + Math.random() * 0.4;
          }
          
          const lat = bounds.getSouth() + (i + latOffset) * latStep;
          const lng = bounds.getWest() + (j + lngOffset) * lngStep;
          
          if (isPointInPolygon([lat, lng], polygon.points)) {
            points.push({ lat, lng });
          }
        }
      }
      
      // Fallback strategies if no points found
      if (points.length === 0) {
        console.warn(`No grid points found inside polygon ${polygon.id}, using fallback strategies`);
        
        // Strategy 1: Try polygon centroid
        const center = bounds.getCenter();
        if (isPointInPolygon([center.lat, center.lng], polygon.points)) {
          points.push({ lat: center.lat, lng: center.lng });
        } else {
          // Strategy 2: Try vertices of the polygon
          for (const point of polygon.points.slice(0, 3)) { // Try first 3 vertices
            if (Array.isArray(point) && point.length >= 2) {
              points.push({ lat: point[0], lng: point[1] });
              break;
            }
          }
        }
        
        // Strategy 3: Force center point as last resort
        if (points.length === 0) {
          points.push({ lat: center.lat, lng: center.lng });
        }
      }
      
      return points;
    } catch (error) {
      console.error('Error generating grid points:', error);
      return [];
    }
  }, [isPointInPolygon, calculatePolygonArea, calculateOptimalGridSize]);

  // Enhanced aggregation with outlier detection
  const aggregateValues = useCallback((values, aggregationType = 'average') => {
    if (!Array.isArray(values)) return null;
    
    const validValues = values.filter(v => 
      v !== null && 
      v !== undefined && 
      typeof v === 'number' && 
      !isNaN(v)
    );
    
    if (validValues.length === 0) return null;
    
    try {
      // Remove outliers for better aggregation (only if we have enough data points)
      let processedValues = validValues;
      if (validValues.length >= 5) {
        const sorted = [...validValues].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
        // Filter out extreme outliers
        const filteredValues = validValues.filter(v => v >= lowerBound && v <= upperBound);
        if (filteredValues.length >= Math.ceil(validValues.length * 0.7)) {
          processedValues = filteredValues;
        }
      }
      
      switch (aggregationType) {
        case 'average':
          return processedValues.reduce((sum, v) => sum + v, 0) / processedValues.length;
        case 'min':
          return Math.min(...processedValues);
        case 'max':
          return Math.max(...processedValues);
        case 'median':
          const sorted = [...processedValues].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        case 'weighted_average':
          // Simple weighted average (can be enhanced with distance weighting)
          return processedValues.reduce((sum, v) => sum + v, 0) / processedValues.length;
        default:
          return processedValues.reduce((sum, v) => sum + v, 0) / processedValues.length;
      }
    } catch (error) {
      console.error('Error aggregating values:', error);
      return validValues[0] || null;
    }
  }, []);

  // Enhanced label generation
  const generateLabel = useCallback((polygon, aggregatedValue, sampleCount, minValue, maxValue, timeRange) => {
    try {
      if (!polygon || !polygon.dataSource || aggregatedValue === null || aggregatedValue === undefined) {
        return null;
      }

      const hoursDifference = timeRange?.end && timeRange?.start ? 
        Math.abs(timeRange.end - timeRange.start) : 0;
      const timeInfo = hoursDifference > 1 ? ` (${hoursDifference}h avg)` : '';
      const dataSourceLabel = polygon.dataSource.replace(/_/g, ' ');
      
      // Calculate area for display
      const areaKm2 = calculatePolygonArea(polygon.points);
      const areaInfo = areaKm2 > 1 ? ` [~${areaKm2.toFixed(1)} km²]` : '';
      
      // Show range if there's significant variation and multiple samples
      const showRange = sampleCount > 1 && 
        minValue !== undefined && 
        maxValue !== undefined && 
        Math.abs(maxValue - minValue) > 1.0; // Increased threshold for showing range
      
      const rangeInfo = showRange ? ` (${minValue.toFixed(1)}-${maxValue.toFixed(1)})` : '';
      const sampleInfo = sampleCount > 1 ? ` [${sampleCount} pts]` : '';
      
      return `${dataSourceLabel}: ${aggregatedValue.toFixed(1)}°${rangeInfo}${sampleInfo}${areaInfo}${timeInfo}`;
    } catch (error) {
      console.error('Error generating label:', error);
      return `${polygon.dataSource}: Error`;
    }
  }, [calculatePolygonArea]);

  // Optimized batch fetching with parallel processing and better error handling
  const fetchDataForPolygons = useCallback(async (forceRefresh = false) => {
    if (fetchingRef.current) return;
    if (!polygons || polygons.length === 0) return;

    fetchingRef.current = true;
    console.log(`Starting data fetch for ${polygons.length} polygons...`);

    try {
      const updatePromises = polygons.map(async (polygon) => {
        try {
          if (!polygon || !polygon.dataSource) return { success: false, reason: 'No data source' };
          if (!forceRefresh && polygon.value !== undefined) return { success: false, reason: 'Already has data' };

          // Generate grid points within the polygon
          const gridPoints = generateGridPoints(polygon);
          
          if (gridPoints.length === 0) {
            console.warn(`No valid grid points generated for polygon ${polygon.id}`);
            return { success: false, reason: 'No valid grid points' };
          }

          console.log(`Fetching ${gridPoints.length} points for polygon ${polygon.id}`);

          // Fetch temperature data for all grid points with staggered requests to avoid rate limiting
          const batchSize = 3; // Process 3 requests at a time
          const allValues = [];
          
          for (let i = 0; i < gridPoints.length; i += batchSize) {
            const batch = gridPoints.slice(i, i + batchSize);
            const batchPromises = batch.map((point, idx) => 
              Promise.race([
                fetchTemperature(point.lat, point.lng, polygon.dataSource, timeRange),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Timeout')), 15000) // 15 second timeout
                )
              ]).catch(error => {
                console.warn(`Failed to fetch temperature for point ${i + idx} (${point.lat}, ${point.lng}):`, error.message);
                return null;
              })
            );
            
            const batchValues = await Promise.all(batchPromises);
            allValues.push(...batchValues);
            
            // Small delay between batches to be nice to the API
            if (i + batchSize < gridPoints.length) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
          
          const validValues = allValues.filter(v => v !== null && v !== undefined && typeof v === 'number');
          
          if (validValues.length === 0) {
            console.warn(`No valid temperature data found for polygon ${polygon.id}`);
            return { success: false, reason: 'No valid data' };
          }

          // Calculate statistics
          const aggregatedValue = aggregateValues(validValues, 'average');
          const minValue = Math.min(...validValues);
          const maxValue = Math.max(...validValues);
          const dataQuality = (validValues.length / gridPoints.length) * 100;
          
          console.log(`Polygon ${polygon.id}: ${validValues.length}/${gridPoints.length} points (${dataQuality.toFixed(0)}% success rate)`);
          
          if (aggregatedValue === null) {
            console.warn(`Failed to aggregate values for polygon ${polygon.id}`);
            return { success: false, reason: 'Aggregation failed' };
          }

          // Generate enhanced label
          const label = generateLabel(
            polygon, 
            aggregatedValue, 
            validValues.length, 
            minValue, 
            maxValue, 
            timeRange
          );
          
          if (!label) {
            console.warn(`Failed to generate label for polygon ${polygon.id}`);
            return { success: false, reason: 'Label generation failed' };
          }

          // Update polygon with additional metadata
          updatePolygon({ 
            ...polygon, 
            value: aggregatedValue,
            label,
            metadata: {
              sampleCount: validValues.length,
              totalRequested: gridPoints.length,
              dataQuality,
              minValue,
              maxValue,
              lastUpdated: new Date().toISOString()
            }
          });
          
          return { success: true, sampleCount: validValues.length };
        } catch (error) {
          console.error(`Error processing polygon ${polygon?.id}:`, error);
          return { success: false, reason: error.message };
        }
      });

      const results = await Promise.all(updatePromises);
      const successResults = results.filter(r => r.success);
      const totalSamples = successResults.reduce((sum, r) => sum + (r.sampleCount || 0), 0);
      
      console.log(`Fetch complete: ${successResults.length}/${polygons.length} polygons updated, ${totalSamples} total data points`);

    } catch (error) {
      console.error('Error in fetchDataForPolygons:', error);
    } finally {
      fetchingRef.current = false;
    }
  }, [polygons, generateGridPoints, aggregateValues, generateLabel, updatePolygon, timeRange]);

  // Memoize filtered polygons to prevent unnecessary re-renders
  const polygonsNeedingData = useMemo(() => 
    polygons?.filter(p => p?.dataSource && p?.value === undefined) || [], 
    [polygons]
  );

  const polygonsWithDataSource = useMemo(() => 
    polygons?.filter(p => p?.dataSource) || [], 
    [polygons]
  );

  const polygonValuesString = useMemo(() => 
    polygons?.map(p => p?.value).join(',') || '', 
    [polygons]
  );

  // Effect for initial data fetching
  useEffect(() => {
    if (polygonsNeedingData.length > 0) {
      fetchDataForPolygons(false);
    }
  }, [polygonsNeedingData, fetchDataForPolygons]);

  // Effect for time range changes
  useEffect(() => {
    if (polygonsWithDataSource.length > 0) {
      fetchDataForPolygons(true);
    }
  }, [timeRange, polygonsWithDataSource, fetchDataForPolygons]);

  // Effect for threshold evaluation
  useEffect(() => {
    if (thresholdRules?.length > 0 && polygons?.some(p => p?.value !== undefined)) {
      try {
        evaluateThresholds();
      } catch (error) {
        console.error('Error evaluating thresholds:', error);
      }
    }
  }, [thresholdRules, polygonValuesString, evaluateThresholds]);

  // Return early if required context data is not available
  if (!polygons) {
    console.warn('Polygons data not available from context');
    return <div>Loading map...</div>;
  }

  return (
    <MapContainer 
      center={[51.505, -0.09]} 
      zoom={13} 
      style={{ height: '100vh' }}
      key="map-container"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <LeafletDrawControl />
      {polygons.map((polygon) => {
        // Add validation for polygon data
        if (!polygon || !polygon.id || !polygon.points || !Array.isArray(polygon.points)) {
          console.warn('Invalid polygon data:', polygon);
          return null;
        }

        return (
          <Polygon
            key={polygon.id}
            positions={polygon.points}
            pathOptions={{
              color: polygon.color || '#3388ff',
              fillColor: polygon.color || '#3388ff',
              fillOpacity: 0.3,
              weight: 2,
              opacity: 1
            }}
          >
            {polygon.label && (
              <Tooltip permanent>
                <div className="text-sm font-medium">
                  {polygon.label}
                  {polygon.metadata?.dataQuality && (
                    <div className="text-xs text-gray-600 mt-1">
                      Data Quality: {polygon.metadata.dataQuality.toFixed(0)}%
                    </div>
                  )}
                </div>
              </Tooltip>
            )}
          </Polygon>
        );
      })}
    </MapContainer>
  );
};

export default ReactMap;