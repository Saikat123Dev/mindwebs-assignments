import * as L from 'leaflet';
import 'leaflet-draw';
import { useContext, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { AppContext } from '../store/context';

const LeafletDrawControl = () => {
  const map = useMap();
  const { addPolygon, deletePolygon, updatePolygon, dataSources, polygons } = useContext(AppContext)!;
  const drawnItemsRef = useRef<L.FeatureGroup>(new L.FeatureGroup());
  
  const processedLayers = useRef<Set<number>>(new Set());

  useEffect(() => {
    const drawnItems = drawnItemsRef.current;
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      edit: {
        featureGroup: drawnItems,
        edit: {
          selectedPathOptions: {
          
            dashArray: '10,10'
          }
        }
      },
      draw: {
        polygon: {
          allowIntersection: false,
        
          drawError: {
            color: '#e1e100',
            message: '<strong>Polygon drawing error</strong>: Shape edges cannot cross!'
          },
          shapeOptions: {
            color: '#3388ff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.3
          },
        },
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
    });

    map.addControl(drawControl);

    const validatePolygon = (points: L.LatLng[]): boolean => {
      if (points.length < 3) {
        alert('Polygon must have at least 3 vertices!');
        return false;
      }
      if (points.length > 12) {
        alert('Polygon cannot have more than 12 vertices!');
        return false;
      }
      return true;
    };

    map.on(L.Draw.Event.CREATED, (event: any) => {
      const layer = event.layer;
      const points = layer.getLatLngs()[0];
      
      if (!validatePolygon(points)) {
        return; 
      }

      const layerStamp = L.Util.stamp(layer);
      
      if (processedLayers.current.has(layerStamp)) {
        return;
      }
      processedLayers.current.add(layerStamp);

      const uniqueId = `polygon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const polygonPoints = points.map((latlng: L.LatLng) => ({ lat: latlng.lat, lng: latlng.lng }));
      
      const dataSource = dataSources.length === 1 ? dataSources[0] : undefined;
      
      const existingPolygon = polygons.find(p => 
        JSON.stringify(p.points) === JSON.stringify(polygonPoints)
      );
      
      if (!existingPolygon) {
        addPolygon({ 
          id: uniqueId, 
          points: polygonPoints,
          dataSource,
          color: '#3388ff'
        });
      }
      
      drawnItems.addLayer(layer);
    });

    map.on(L.Draw.Event.EDITED, (event: any) => {
      event.layers.eachLayer((layer: any) => {
        const points = layer.getLatLngs()[0];
        
        if (!validatePolygon(points)) {
          event.layers.removeLayer(layer);
          return;
        }

        const id = L.Util.stamp(layer).toString();
        const polygonPoints = points.map((latlng: L.LatLng) => ({ lat: latlng.lat, lng: latlng.lng }));
        updatePolygon({ id, points: polygonPoints });
      });
    });

    map.on(L.Draw.Event.DELETED, (event: any) => {
      event.layers.eachLayer((layer: any) => {
        const id = L.Util.stamp(layer).toString();
        deletePolygon(id);
      });
    });

    return () => {
      map.removeControl(drawControl);
      map.removeLayer(drawnItems);
    };
  }, [map, addPolygon, deletePolygon, updatePolygon, dataSources]);

  return null;
};

export default LeafletDrawControl;
