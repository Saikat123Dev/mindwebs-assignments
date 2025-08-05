import * as L from 'leaflet';
import { useContext, useEffect, useRef } from 'react';
import { MapContainer, Polygon, TileLayer, Tooltip } from 'react-leaflet';
import { AppContext } from '../store/context';
import { fetchTemperature } from '../utils/fetchWeather';
import LeafletDrawControl from './LeafLetDrawControl';

const ReactMap = () => {
  const { polygons, updatePolygon, setThresholdRules, thresholdRules, evaluateThresholds, timeRange } = useContext(AppContext)!;
  const fetchingRef = useRef(false);

  useEffect(() => {
    
    setThresholdRules([
      { operator: '<', value: 10, color: '#ff0000' },
      { operator: '>=', value: 10, color: '#0000ff' },
      { operator: '>=', value: 25, color: '#00ff00' },
    ]);
  }, [setThresholdRules]);

  const fetchDataForPolygons = async (forceRefresh = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const updatePromises = polygons.map(async (polygon) => {
        if (polygon.dataSource && (polygon.value === undefined || forceRefresh)) {
          const center = L.polygon(polygon.points).getBounds().getCenter();
          const value = await fetchTemperature(center.lat, center.lng, polygon.dataSource, timeRange);
          if (value !== null) {
            const hoursDifference = timeRange.end - timeRange.start;
            const timeInfo = hoursDifference > 1 ? ` (${hoursDifference}h avg)` : '';
            const label = `${polygon.dataSource.replace('_', ' ')}: ${value}${timeInfo}`;
            updatePolygon({ ...polygon, value, label });
            return true;
          }
        }
        return false;
      });

      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error fetching polygon data:', error);
    } finally {
      fetchingRef.current = false;
    }
  };

  useEffect(() => {
    const polygonsWithDataSource = polygons.filter(p => p.dataSource && p.value === undefined);
    if (polygonsWithDataSource.length > 0) {
      fetchDataForPolygons();
    }
  }, [polygons]);

  
  useEffect(() => {
    const polygonsWithDataSource = polygons.filter(p => p.dataSource);
    if (polygonsWithDataSource.length > 0) {
      fetchDataForPolygons(true); 
    }
  }, [timeRange]);

  useEffect(() => {
    if (thresholdRules.length > 0 && polygons.some(p => p.value !== undefined)) {
      evaluateThresholds();
    }
  }, [thresholdRules, polygons.map(p => p.value).join(',')]);

  return (
    <MapContainer center={[51.505, -0.09]} zoom={13} style={{ height: '100vh' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <LeafletDrawControl />
      {polygons.map((polygon) => (
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
              </div>
            </Tooltip>
          )}
        </Polygon>
      ))}
    </MapContainer>
  );
};

export default ReactMap;
