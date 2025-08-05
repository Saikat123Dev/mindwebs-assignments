
import { useContext } from 'react';
import { AppContext } from '../store/context';

const PolygonSidebar = () => {
  const { polygons, dataSources, updatePolygon, thresholdRules, setThresholdRules, deletePolygon } = useContext(AppContext)!;

  const operatorOptions = [
    { value: '<', label: 'Less than (<)' },
    { value: '<=', label: 'Less than or equal (<=)' },
    { value: '=', label: 'Equal (=)' },
    { value: '>=', label: 'Greater than or equal (>=)' },
    { value: '>', label: 'Greater than (>)' },
  ];

  const handleDataSourceChange = (polygonId: string, dataSource: string) => {
    const polygon = polygons.find((p) => p.id === polygonId);
    if (polygon) {
      updatePolygon({ ...polygon, dataSource });
    }
  };

  const handleOperatorChange = (index: number, operator: string) => {
    const newRules = [...thresholdRules];
    newRules[index].operator = operator as '<' | '<=' | '=' | '>=' | '>';
    setThresholdRules(newRules);
  };

  const handleValueChange = (index: number, value: number) => {
    const newRules = [...thresholdRules];
    newRules[index].value = value;
    setThresholdRules(newRules);
  };

  const handleColorChange = (index: number, color: string) => {
    const newRules = [...thresholdRules];
    newRules[index].color = color;
    setThresholdRules(newRules);
  };

  const addThresholdRule = () => {
    setThresholdRules([...thresholdRules, { operator: '>', value: 0, color: '#000000' }]);
  };

  const removeThresholdRule = (index: number) => {
    const newRules = thresholdRules.filter((_, i) => i !== index);
    setThresholdRules(newRules);
  };

  return (
    <div className="p-4 h-full overflow-y-auto">
      <h2 className="text-lg font-bold mb-4">Polygons ({polygons.length})</h2>
      {polygons.map((polygon) => (
        <div key={polygon.id} className="mb-4 p-3 border rounded-lg bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-gray-800">Polygon {polygon.id}</h3>
            <button
              onClick={() => deletePolygon(polygon.id)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              Delete
            </button>
          </div>
          <div className="mt-2">
            <label className="block text-sm font-medium text-gray-700">Data Source</label>
            <select
              value={polygon.dataSource || ''}
              onChange={(e) => handleDataSourceChange(polygon.id, e.target.value)}
              className="mt-1 block w-full p-2 border rounded-md bg-white"
            >
              <option value="">Select data source...</option>
              {[...new Set(dataSources)].map((source) => (
                <option key={source} value={source}>
                  {source.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          {polygon.value !== undefined && (
            <div className="mt-2">
              <label className="block text-sm font-medium text-gray-700">
                Value: <span className="font-bold text-blue-600">{polygon.value}</span>
              </label>
            </div>
          )}
          {polygon.color && (
            <div className="mt-2 flex items-center">
              <label className="block text-sm font-medium text-gray-700 mr-2">Color:</label>
              <div 
                className="w-6 h-6 rounded border-2 border-gray-300"
                style={{ backgroundColor: polygon.color }}
              ></div>
            </div>
          )}
        </div>
      ))}
      
      <div className="mt-6">
        <h3 className="text-lg font-bold mb-3">Threshold Rules</h3>
        {thresholdRules.map((rule, index) => (
          <div key={index} className="flex items-center gap-2 mt-3 p-2 bg-gray-50 rounded">
            <select
              value={rule.operator}
              onChange={(e) => handleOperatorChange(index, e.target.value)}
              className="p-2 border rounded bg-white"
            >
              {operatorOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <input
              type="number"
              value={rule.value}
              onChange={(e) => handleValueChange(index, Number(e.target.value))}
              className="p-2 border rounded w-20 bg-white"
              placeholder="Value"
            />
            <input
              type="color"
              value={rule.color}
              onChange={(e) => handleColorChange(index, e.target.value)}
              className="p-1 border rounded w-12 h-10 bg-white"
            />
            <button
              onClick={() => removeThresholdRule(index)}
              className="text-red-500 hover:text-red-700 text-sm px-2"
            >
              Remove
            </button>
          </div>
        ))}
        <button 
          onClick={addThresholdRule} 
          className="mt-3 p-2 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
        >
          Add Rule
        </button>
      </div>
    </div>
  );
};

export default PolygonSidebar;

