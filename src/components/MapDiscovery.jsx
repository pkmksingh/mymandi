import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { getOptimizedImage } from '../utils/image';
import { useEffect } from 'react';

// Fix Leaflet marker icons tracking
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function MapCenteringController({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center?.lat) {
      map.setView([center.lat, center.lng], 10);
    }
  }, [center, map]);
  return null;
}

export function MapDiscovery({ listings, center }) {
  const navigate = useNavigate();
  const mapCenter = center?.lat ? [center.lat, center.lng] : [20.5937, 78.9629]; // Default India

  return (
    <div style={{ height: '400px', width: '100%', borderRadius: '20px', overflow: 'hidden', border: '2px solid var(--border-color)', marginBottom: '24px' }}>
      <MapContainer center={mapCenter} zoom={10} style={{ height: '100%', width: '100%' }}>
        <MapCenteringController center={center} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {listings.map(l => (
          <Marker key={l.id} position={[l.location.lat, l.location.lng]}>
            <Popup>
              <div 
                onClick={() => navigate(`/buyer/listing/${l.id}`)}
                style={{ cursor: 'pointer', textAlign: 'center' }}
              >
                <img 
                  src={getOptimizedImage(l.images[0], 100, 100)} 
                  style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', marginBottom: '8px' }}
                />
                <div style={{ fontWeight: 'bold' }}>{l.cropName}</div>
                <div style={{ color: 'var(--primary-color)' }}>{l.price}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
