import { useContext } from 'react';
import { AppContext } from '../store/context';

const PolygonSidebar = () => {
  const {
    polygons,
    dataSources,
    updatePolygon,
    thresholdRules,
    setThresholdRules,
    deletePolygon,
  } = useContext(AppContext)!;

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
    setThresholdRules([
      ...thresholdRules,
      { operator: '>', value: 0, color: '#000000' },
    ]);
  };

  const removeThresholdRule = (index: number) => {
    const newRules = thresholdRules.filter((_, i) => i !== index);
    setThresholdRules(newRules);
  };

  return (
    <div className="p-5 h-full overflow-y-auto bg-white shadow-lg rounded-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Polygons <span className="text-blue-600">({polygons.length})</span>
      </h2>

      {polygons.map((polygon) => (
        <div
          key={polygon.id}
          className="mb-6 p-4 border border-gray-200 rounded-xl shadow-sm bg-gray-50"
        >
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-700">
              Polygon #{polygon.id}
            </h3>
            <button
              onClick={() => deletePolygon(polygon.id)}
              className="text-red-500 hover:text-red-700 text-sm font-medium"
            >
              ✕ Delete
            </button>
          </div>

          <div className="mt-2">
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Data Source
            </label>
            <select
              value={polygon.dataSource || ''}
              onChange={(e) =>
                handleDataSourceChange(polygon.id, e.target.value)
              }
              className="block w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Select data source...</option>
              {[...new Set(dataSources)].map((source) => (
                <option key={source} value={source}>
                  {source
                    .replace('_', ' ')
                    .replace(/\b\w/g, (l) => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          {polygon.value !== undefined && (
            <div className="mt-3">
              <span className="text-sm text-gray-700">
                Value:{' '}
                <span className="font-semibold text-blue-600">
                  {polygon.value}
                </span>
              </span>
            </div>
          )}

          {polygon.color && (
            <div className="mt-3 flex items-center">
              <span className="text-sm text-gray-700 mr-2">Color:</span>
              <div
                className="w-6 h-6 rounded-full border border-gray-300"
                style={{ backgroundColor: polygon.color }}
              ></div>
            </div>
          )}
        </div>
      ))}

      <div className="mt-8">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          Threshold Rules
        </h3>

      {thresholdRules.map((rule, index) => (
  <div
    key={index}
    className="flex flex-wrap sm:flex-nowrap items-center gap-3 mb-3 p-3 bg-gray-100 rounded-lg shadow-sm"
  >
    <select
      value={rule.operator}
      onChange={(e) => handleOperatorChange(index, e.target.value)}
      className="flex-1 p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-400 min-w-[150px]"
    >
      {operatorOptions.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>

    <input
      type="number"
      value={rule.value}
      onChange={(e) => handleValueChange(index, Number(e.target.value))}
      className="w-24 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-400"
      placeholder="Value"
    />

    <input
      type="color"
      value={rule.color}
      onChange={(e) => handleColorChange(index, e.target.value)}
      className="w-10 h-10 p-1 border border-gray-300 rounded-md bg-white cursor-pointer"
      title="Pick color"
    />

    <button
      onClick={() => removeThresholdRule(index)}
      className="flex items-center text-sm text-red-600 hover:text-red-800 font-medium ml-auto"
    >
      🗑 <span className="ml-1 hidden sm:inline">Remove</span>
    </button>
  </div>
))}


        <button
          onClick={addThresholdRule}
          className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition duration-200"
        >
          ➕ Add Rule
        </button>
      </div>
    </div>
  );
};

export default PolygonSidebar;
