export const ROWS_OPTIONS = [8, 10, 20, 50];

export const DENSITY_COLORS = {
  low:    'bg-green-400',
  medium: 'bg-orange-300',
  high:   'bg-red-400',
  empty:  'bg-slate-100',
  null:   'bg-slate-100',
};

export const SPECIES_COLORS = {
  Crabgrass: 'bg-green-600',
  Nutsedge:  'bg-orange-400',
  Purslane:  'bg-red-400',
  Other:     'bg-slate-400',
};

export const COMMANDS = ['Move forward', 'Move backward', 'Turn left', 'Turn right', 'Detect weed'];

export const CONFIG_KEYS = [
  'device_id',
  'server_url',
  'serial_port',
  'serial_baud_rate',
  'camera_index',
  'confidence_threshold',
];

export const CONFIG_FIELDS = [
  { key: 'device_id',               label: 'Device ID',                placeholder: 'e.g. DEV-004' },
  { key: 'device_secret',           label: 'Device Secret',            placeholder: 'e.g. my-secret' },
  { key: 'server_url',              label: 'Server URL',               placeholder: 'e.g. http://192.168.1.18:5000' },
  { key: 'serial_port',             label: 'Serial Port',              placeholder: 'e.g. /dev/ttyUSB0' },
  { key: 'serial_baud_rate',        label: 'Serial Baud Rate',         placeholder: 'e.g. 115200' },
  { key: 'camera_index',            label: 'Camera Index',             placeholder: 'e.g. 0' },
  { key: 'confidence_threshold',    label: 'Confidence Threshold',     placeholder: 'e.g. 0.75' },
  { key: 'camera_vision_width_cm',  label: 'Camera Vision Width (cm)', placeholder: 'e.g. 50' },
];
