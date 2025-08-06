import * as L from 'leaflet';
import { useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { MapContainer, Polygon, TileLayer, Tooltip } from 'react-leaflet';
import { AppContext } from '../store/context';
import { fetchTemperature } from '../utils/fetchWeather';
import LeafletDrawControl from './LeafLetDrawControl';

// Define necessary types
type Point = [number, number];
type PolygonType = {
  id: string;
  points: Point[];
  dataSource?: string;
  value?: number;
  color?: string;
  label?: string;
  metadata?: {
    sampleCount: number;
    totalRequested: number;
    dataQuality: number;
    minValue: number;
    maxValue: number;
    lastUpdated: string;
  };
};
type TimeRange = {
  start?: number;
  end?: number;
};
type AppContextType = {
  polygons?: PolygonType[];
  updatePolygon?: (polygon: PolygonType) => void;
  setThresholdRules?: (rules: any) => void;
  thresholdRules?: any[];
  evaluateThresholds?: () => void;
  timeRange?: TimeRange;
};

const ReactMap = () => {
  const context = useContext(AppContext) as AppContextType | undefined;
  const {
    polygons = [],
    updatePolygon = () => {},
    setThresholdRules = () => {},
    thresholdRules = [],
    evaluateThresholds = () => {},
    timeRange = {}
  } = context || {};

  const fetchingRef = useRef(false);

  useEffect(() => {
    setThresholdRules([
      { operator: '<', value: 10, color: '#ff0000' },
      { operator: '>=', value: 10, color: '#0000ff' },
      { operator: '>=', value: 25, color: '#00ff00' },
    ]);
  }, [setThresholdRules]);

  const calculatePolygonArea = useCallback((polygonPoints: Point[]) => {
    if (!polygonPoints || polygonPoints.length < 3) return 0;
    
    try {
      const leafletPolygon = L.polygon(polygonPoints);
      const bounds = leafletPolygon.getBounds();
      
      const latDiff = bounds.getNorth() - bounds.getSouth();
      const lngDiff = bounds.getEast() - bounds.getWest();
      
      const avgLat = (bounds.getNorth() + bounds.getSouth()) / 2;
      const latToKm = 111;
      const lngToKm = 111 * Math.cos(avgLat * Math.PI / 180);
      
      const areaKm2 = (latDiff * latToKm) * (lngDiff * lngToKm);
      return Math.max(areaKm2, 0.1);
    } catch (error) {
      console.error('Error calculating polygon area:', error);
      return 1;
    }
  }, []);

  const calculateOptimalGridSize = useCallback((areaKm2: number) => {
    let gridSize;
    
    if (areaKm2 <= 1) gridSize = 2;
    else if (areaKm2 <= 10) gridSize = 3;
    else if (areaKm2 <= 50) gridSize = 4;
    else if (areaKm2 <= 200) gridSize = 5;
    else if (areaKm2 <= 500) gridSize = 6;
    else gridSize = 7;

    const targetDensity = 0.3;
    const calculatedSize = Math.sqrt(areaKm2 * targetDensity);
    const dynamicSize = Math.max(2, Math.min(8, Math.ceil(calculatedSize)));
    
    return Math.max(gridSize, dynamicSize);
  }, []);

  const isPointInPolygon = useCallback((point: Point, polygonPoints: Point[]) => {
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

  const generateGridPoints = useCallback((polygon: PolygonType) => {
    if (!polygon || !polygon.points || polygon.points.length < 3) {
      console.warn('Invalid polygon data for grid generation');
      return [];
    }

    try {
      const leafletPolygon = L.polygon(polygon.points);
      const bounds = leafletPolygon.getBounds();
      
      const areaKm2 = calculatePolygonArea(polygon.points);
      const gridSize = calculateOptimalGridSize(areaKm2);
      
      const points: L.LatLngTuple[] = [];
      
      const latStep = (bounds.getNorth() - bounds.getSouth()) / gridSize;
      const lngStep = (bounds.getEast() - bounds.getWest()) / gridSize;
      
      if (latStep <= 0 || lngStep <= 0) {
        console.warn('Invalid polygon bounds for grid generation');
        const center = bounds.getCenter();
        return [[center.lat, center.lng]];
      }
      
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          let latOffset, lngOffset;
          
          if (gridSize <= 3) {
            latOffset = 0.5;
            lngOffset = 0.5;
          } else {
            latOffset = 0.3 + Math.random() * 0.4;
            lngOffset = 0.3 + Math.random() * 0.4;
          }
          
          const lat = bounds.getSouth() + (i + latOffset) * latStep;
          const lng = bounds.getWest() + (j + lngOffset) * lngStep;
          
          if (isPointInPolygon([lat, lng], polygon.points)) {
            points.push([lat, lng]);
          }
        }
      }
      
      if (points.length === 0) {
        console.warn(`No grid points found inside polygon ${polygon.id}, using fallback strategies`);
        const center = bounds.getCenter();
        points.push([center.lat, center.lng]);
      }
      
      return points;
    } catch (error) {
      console.error('Error generating grid points:', error);
      return [];
    }
  }, [isPointInPolygon, calculatePolygonArea, calculateOptimalGridSize]);

  const aggregateValues = useCallback((values: (number | null)[], aggregationType = 'average') => {
    if (!Array.isArray(values)) return null;
    
    const validValues = values.filter((v): v is number => 
      v !== null && typeof v === 'number' && !isNaN(v)
    );
    
    if (validValues.length === 0) return null;
    
    try {
      let processedValues = validValues;
      if (validValues.length >= 5) {
        const sorted = [...validValues].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        const lowerBound = q1 - 1.5 * iqr;
        const upperBound = q3 + 1.5 * iqr;
        
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
          return processedValues.reduce((sum, v) => sum + v, 0) / processedValues.length;
        default:
          return processedValues.reduce((sum, v) => sum + v, 0) / processedValues.length;
      }
    } catch (error) {
      console.error('Error aggregating values:', error);
      return validValues[0] || null;
    }
  }, []);

  const generateLabel = useCallback((
    polygon: PolygonType,
    aggregatedValue: number,
    sampleCount: number,
    minValue: number,
    maxValue: number,
    timeRange: TimeRange
  ) => {
    try {
      if (!polygon?.dataSource || aggregatedValue === null) return null;

      const hoursDifference = timeRange.end && timeRange.start ? 
        Math.abs(timeRange.end - timeRange.start) / 3600000 : 0;
      const timeInfo = hoursDifference > 1 ? ` (${hoursDifference.toFixed(1)}h avg)` : '';
      const dataSourceLabel = polygon.dataSource.replace(/_/g, ' ');
      
      const areaKm2 = calculatePolygonArea(polygon.points);
      const areaInfo = areaKm2 > 1 ? ` [~${areaKm2.toFixed(1)} km²]` : '';
      
      const showRange = sampleCount > 1 && Math.abs(maxValue - minValue) > 1.0;
      const rangeInfo = showRange ? ` (${minValue.toFixed(1)}-${maxValue.toFixed(1)})` : '';
      const sampleInfo = sampleCount > 1 ? ` [${sampleCount} pts]` : '';
      
      return `${dataSourceLabel}: ${aggregatedValue.toFixed(1)}°${rangeInfo}${sampleInfo}${areaInfo}${timeInfo}`;
    } catch (error) {
      console.error('Error generating label:', error);
      return `${polygon.dataSource}: Error`;
    }
  }, [calculatePolygonArea]);

  const fetchDataForPolygons = useCallback(async (forceRefresh = false) => {
    if (fetchingRef.current) return;
    if (!polygons || polygons.length === 0) return;

    fetchingRef.current = true;

    try {
      const updatePromises = polygons.map(async (polygon) => {
        try {
          if (!polygon.dataSource) return { success: false, reason: 'No data source' };
          if (!forceRefresh && polygon.value !== undefined) return { success: false, reason: 'Already has data' };

          const gridPoints = generateGridPoints(polygon);
          if (gridPoints.length === 0) {
            return { success: false, reason: 'No valid grid points' };
          }

          const allValues: (number | null)[] = [];
          const batchSize = 3;
          
          for (let i = 0; i < gridPoints.length; i += batchSize) {
            const batch = gridPoints.slice(i, i + batchSize);
            const batchPromises = batch.map((point) => 
              fetchTemperature(
                point[0],
                point[1],
                polygon.dataSource!,
                {
                  start: typeof timeRange.start === 'number' ? timeRange.start : Date.now(),
                  end: typeof timeRange.end === 'number' ? timeRange.end : Date.now()
                }
              )
                .catch(error => {
                  console.warn(`Failed to fetch temperature:`, error.message);
                  return null;
                })
            );
            
            const batchValues = await Promise.all(batchPromises);
            allValues.push(...batchValues);
            
            if (i + batchSize < gridPoints.length) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
          
          const validValues = allValues.filter((v): v is number => v !== null);
          
          if (validValues.length === 0) {
            return { success: false, reason: 'No valid data' };
          }

          const aggregatedValue = aggregateValues(validValues, 'average');
          const minValue = Math.min(...validValues);
          const maxValue = Math.max(...validValues);
          
          if (aggregatedValue === null) {
            return { success: false, reason: 'Aggregation failed' };
          }

          const label = generateLabel(
            polygon, 
            aggregatedValue, 
            validValues.length, 
            minValue, 
            maxValue, 
            timeRange
          );
          
          if (!label) {
            return { success: false, reason: 'Label generation failed' };
          }

          updatePolygon({ 
            ...polygon, 
            value: aggregatedValue,
            label,
            metadata: {
              sampleCount: validValues.length,
              totalRequested: gridPoints.length,
              dataQuality: (validValues.length / gridPoints.length) * 100,
              minValue,
              maxValue,
              lastUpdated: new Date().toISOString()
            }
          });
          
          return { success: true, sampleCount: validValues.length };
        } catch (error) {
          console.error(`Error processing polygon ${polygon?.id}:`, error);
          return { success: false, reason: (error as Error).message };
        }
      });

      const results = await Promise.all(updatePromises);
      const successResults = results.filter(r => r.success);
      const totalSamples = successResults.reduce((sum, r) => sum + (r.sampleCount || 0), 0);
    } catch (error) {
      console.error('Error in fetchDataForPolygons:', error);
    } finally {
      fetchingRef.current = false;
    }
  }, [polygons, generateGridPoints, aggregateValues, generateLabel, updatePolygon, timeRange]);

  const polygonsNeedingData = useMemo(() => 
    polygons.filter(p => p.dataSource && p.value === undefined), 
    [polygons]
  );

  const polygonsWithDataSource = useMemo(() => 
    polygons.filter(p => p.dataSource), 
    [polygons]
  );

  const polygonValuesString = useMemo(() => 
    polygons.map(p => p.value).join(','), 
    [polygons]
  );

  useEffect(() => {
    if (polygonsNeedingData.length > 0) {
      fetchDataForPolygons(false);
    }
  }, [polygonsNeedingData, fetchDataForPolygons]);

  useEffect(() => {
    if (polygonsWithDataSource.length > 0) {
      fetchDataForPolygons(true);
    }
  }, [timeRange, polygonsWithDataSource, fetchDataForPolygons]);

  useEffect(() => {
    if (thresholdRules.length > 0 && polygons.some(p => p.value !== undefined)) {
      evaluateThresholds();
    }
  }, [thresholdRules, polygonValuesString, evaluateThresholds, polygons]);

  if (!polygons) {
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
        if (!polygon.points || !Array.isArray(polygon.points)) return null;

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