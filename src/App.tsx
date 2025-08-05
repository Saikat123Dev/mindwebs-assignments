import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet/dist/leaflet.css';
import './App.css';
import LeafletDrawMap from './components/ReactMap';
import PolygonSidebar from './components/PolygonSidebar';
import TimelineSlider from './components/TimeLineSlider';

function App() {
  return (
    <div className="flex flex-col h-screen">
      {/* Timeline Slider at the top */}
      <div className="bg-gray-50 border-b">
        <TimelineSlider mode="range" />
      </div>
      
      {/* Main content area */}
      <div className="flex flex-1">
        <div className="w-3/4">
          <LeafletDrawMap />
        </div>
        <div className="w-1/4">
          <PolygonSidebar />
        </div>
      </div>
    </div>
  );
}

export default App;
