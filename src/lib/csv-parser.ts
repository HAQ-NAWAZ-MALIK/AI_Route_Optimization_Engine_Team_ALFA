/**
 * CSV Parser Utility
 * 
 * Parses and validates CSV files for employees, cabs, and configuration.
 * Includes robust error handling and data validation.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface Employee {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
}

export interface Cab {
    id: string;
    name: string;
    seats: number;
    driver: string;
    lat: number;
    lng: number;
}

export interface Config {
    officeName: string;
    officeAddress: string;
    officeLat: number;
    officeLng: number;
    departureTime: string;
    tripType: 'pickup' | 'drop';
}

export interface ParsedData {
    employees: Employee[];
    cabs: Cab[];
    config: Config;
}

export interface ValidationError {
    file: string;
    row?: number;
    field?: string;
    message: string;
}

export interface ParseResult<T> {
    data: T;
    errors: ValidationError[];
    warnings: string[];
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_CONFIG: Config = {
    officeName: 'Office',
    officeAddress: 'Default Address',
    officeLat: 12.9565,
    officeLng: 77.7010,
    departureTime: '08:00',
    tripType: 'pickup',
};

// ============================================================================
// PARSING UTILITIES
// ============================================================================

/**
 * Parse CSV content into rows, handling quoted fields
 */
function parseCSVRows(content: string): string[][] {
    const lines = content.trim().split(/\r?\n/);
    return lines.map(line => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    });
}

/**
 * Validate latitude value
 */
function isValidLat(lat: number): boolean {
    return !isNaN(lat) && lat >= -90 && lat <= 90;
}

/**
 * Validate longitude value
 */
function isValidLng(lng: number): boolean {
    return !isNaN(lng) && lng >= -180 && lng <= 180;
}

// ============================================================================
// EMPLOYEES PARSER
// ============================================================================

export function parseEmployeesCSV(content: string): ParseResult<Employee[]> {
    const rows = parseCSVRows(content);
    const employees: Employee[] = [];
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (rows.length < 2) {
        errors.push({ file: 'employees.csv', message: 'File is empty or has no data rows' });
        return { data: employees, errors, warnings };
    }

    // Parse header
    const header = rows[0].map(h => h.toLowerCase().trim());

    // Find column indices (flexible naming)
    const idIdx = header.findIndex(h => h === 'id' || h === 'employee_id' || h === 'emp_id');
    const nameIdx = header.findIndex(h => h === 'name' || h === 'employee_name');
    const addressIdx = header.findIndex(h => h === 'address' || h === 'location');
    const latIdx = header.findIndex(h => h === 'lat' || h === 'latitude');
    const lngIdx = header.findIndex(h => h === 'lng' || h === 'longitude' || h === 'lon');

    // Validate required columns
    if (nameIdx === -1) {
        errors.push({ file: 'employees.csv', message: 'Missing required column: name' });
        return { data: employees, errors, warnings };
    }
    if (latIdx === -1 || lngIdx === -1) {
        errors.push({ file: 'employees.csv', message: 'Missing required columns: lat, lng' });
        return { data: employees, errors, warnings };
    }

    // Parse data rows
    const usedIds = new Set<string>();
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.every(cell => !cell)) continue; // Skip empty rows

        const lat = parseFloat(row[latIdx]);
        const lng = parseFloat(row[lngIdx]);

        // Validate coordinates
        if (!isValidLat(lat) || !isValidLng(lng)) {
            errors.push({
                file: 'employees.csv',
                row: i + 1,
                field: 'lat/lng',
                message: `Invalid coordinates: lat=${row[latIdx]}, lng=${row[lngIdx]}`
            });
            continue;
        }

        // Generate or validate ID
        let id = idIdx >= 0 ? row[idIdx] : `E${String(i).padStart(3, '0')}`;
        if (!id || usedIds.has(id)) {
            const newId = `E${String(i).padStart(3, '0')}_${Date.now()}`;
            warnings.push(`Row ${i + 1}: Duplicate/missing ID '${id}', generated '${newId}'`);
            id = newId;
        }
        usedIds.add(id);

        employees.push({
            id,
            name: row[nameIdx] || `Employee ${i}`,
            address: addressIdx >= 0 ? row[addressIdx] : 'Unknown',
            lat,
            lng,
        });
    }

    if (employees.length === 0) {
        errors.push({ file: 'employees.csv', message: 'No valid employee records found' });
    }

    return { data: employees, errors, warnings };
}

// ============================================================================
// CABS PARSER
// ============================================================================

export function parseCabsCSV(content: string): ParseResult<Cab[]> {
    const rows = parseCSVRows(content);
    const cabs: Cab[] = [];
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    if (rows.length < 2) {
        errors.push({ file: 'cabs.csv', message: 'File is empty or has no data rows' });
        return { data: cabs, errors, warnings };
    }

    const header = rows[0].map(h => h.toLowerCase().trim().replace(/_/g, ''));

    // Find column indices
    const idIdx = header.findIndex(h => h.includes('id'));
    const nameIdx = header.findIndex(h => h === 'name' || h.includes('vehicle'));
    const seatsIdx = header.findIndex(h => h.includes('seat') || h.includes('capacity'));
    const driverIdx = header.findIndex(h => h.includes('driver'));
    const latIdx = header.findIndex(h => h === 'lat' || h === 'latitude');
    const lngIdx = header.findIndex(h => h === 'lng' || h === 'longitude');

    // Parse data rows
    const usedIds = new Set<string>();
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.every(cell => !cell)) continue;

        // Parse and validate values
        let id = idIdx >= 0 ? row[idIdx] : `C${String(i).padStart(3, '0')}`;
        if (!id || usedIds.has(id)) {
            id = `C${String(i).padStart(3, '0')}_${Date.now()}`;
        }
        usedIds.add(id);

        const seats = seatsIdx >= 0 ? parseInt(row[seatsIdx]) : 6;
        if (seats < 1 || seats > 50) {
            warnings.push(`Row ${i + 1}: Invalid seats value '${row[seatsIdx]}', using default 6`);
        }

        const lat = latIdx >= 0 ? parseFloat(row[latIdx]) : NaN;
        const lng = lngIdx >= 0 ? parseFloat(row[lngIdx]) : NaN;

        cabs.push({
            id,
            name: nameIdx >= 0 ? row[nameIdx] : `Cab ${i}`,
            seats: (seats >= 1 && seats <= 50) ? seats : 6,
            driver: driverIdx >= 0 ? row[driverIdx] : `Driver ${i}`,
            lat: isValidLat(lat) ? lat : NaN, // Will use office location if NaN
            lng: isValidLng(lng) ? lng : NaN,
        });
    }

    if (cabs.length === 0) {
        errors.push({ file: 'cabs.csv', message: 'No valid cab records found' });
    }

    return { data: cabs, errors, warnings };
}

// ============================================================================
// CONFIG PARSER
// ============================================================================

export function parseConfigCSV(content: string): ParseResult<Config> {
    const rows = parseCSVRows(content);
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const config = { ...DEFAULT_CONFIG };

    if (rows.length < 2) {
        warnings.push('Config file empty, using default values');
        return { data: config, errors, warnings };
    }

    // Config is key-value format
    for (let i = 1; i < rows.length; i++) {
        const [setting, value] = rows[i];
        if (!setting || !value) continue;

        const key = setting.toLowerCase().replace(/[_\s]/g, '');

        switch (key) {
            case 'officename':
                config.officeName = value;
                break;
            case 'officeaddress':
                config.officeAddress = value;
                break;
            case 'officelat': {
                const lat = parseFloat(value);
                if (isValidLat(lat)) {
                    config.officeLat = lat;
                } else {
                    warnings.push(`Invalid office latitude: ${value}`);
                }
                break;
            }
            case 'officelng': {
                const lng = parseFloat(value);
                if (isValidLng(lng)) {
                    config.officeLng = lng;
                } else {
                    warnings.push(`Invalid office longitude: ${value}`);
                }
                break;
            }
            case 'departuretime':
                config.departureTime = value;
                break;
            case 'triptype':
                config.tripType = value.toLowerCase() === 'drop' ? 'drop' : 'pickup';
                break;
        }
    }

    return { data: config, errors, warnings };
}

// ============================================================================
// COMBINED LOADER
// ============================================================================

/**
 * Load sample data from public folder
 */
export async function loadSampleData(): Promise<ParseResult<ParsedData>> {
    const allErrors: ValidationError[] = [];
    const allWarnings: string[] = [];

    try {
        const [empRes, cabRes, configRes] = await Promise.all([
            fetch('/sample-data/employees.csv'),
            fetch('/sample-data/cabs.csv'),
            fetch('/sample-data/config.csv'),
        ]);

        if (!empRes.ok) {
            allErrors.push({ file: 'employees.csv', message: `Failed to load: ${empRes.status}` });
        }
        if (!cabRes.ok) {
            allErrors.push({ file: 'cabs.csv', message: `Failed to load: ${cabRes.status}` });
        }
        if (!configRes.ok) {
            allWarnings.push('Config file not found, using defaults');
        }

        const empContent = empRes.ok ? await empRes.text() : '';
        const cabContent = cabRes.ok ? await cabRes.text() : '';
        const configContent = configRes.ok ? await configRes.text() : '';

        const empResult = empContent ? parseEmployeesCSV(empContent) : { data: [], errors: [], warnings: [] };
        const cabResult = cabContent ? parseCabsCSV(cabContent) : { data: [], errors: [], warnings: [] };
        const configResult = parseConfigCSV(configContent);

        // Fill in missing cab locations with office location
        const config = configResult.data;
        cabResult.data.forEach(cab => {
            if (isNaN(cab.lat)) cab.lat = config.officeLat;
            if (isNaN(cab.lng)) cab.lng = config.officeLng;
        });

        return {
            data: {
                employees: empResult.data,
                cabs: cabResult.data,
                config: configResult.data,
            },
            errors: [...allErrors, ...empResult.errors, ...cabResult.errors, ...configResult.errors],
            warnings: [...allWarnings, ...empResult.warnings, ...cabResult.warnings, ...configResult.warnings],
        };
    } catch (error) {
        allErrors.push({ file: 'general', message: `Load failed: ${error instanceof Error ? error.message : 'Unknown'}` });
        return {
            data: { employees: [], cabs: [], config: DEFAULT_CONFIG },
            errors: allErrors,
            warnings: allWarnings,
        };
    }
}

/**
 * Parse uploaded files
 */
export async function parseUploadedFiles(files: {
    employees?: File;
    cabs?: File;
    config?: File;
}): Promise<ParseResult<Partial<ParsedData>>> {
    const allErrors: ValidationError[] = [];
    const allWarnings: string[] = [];
    const data: Partial<ParsedData> = {};

    if (files.employees) {
        const content = await files.employees.text();
        const result = parseEmployeesCSV(content);
        data.employees = result.data;
        allErrors.push(...result.errors);
        allWarnings.push(...result.warnings);
    }

    if (files.cabs) {
        const content = await files.cabs.text();
        const result = parseCabsCSV(content);
        data.cabs = result.data;
        allErrors.push(...result.errors);
        allWarnings.push(...result.warnings);
    }

    if (files.config) {
        const content = await files.config.text();
        const result = parseConfigCSV(content);
        data.config = result.data;
        allErrors.push(...result.errors);
        allWarnings.push(...result.warnings);
    }

    return { data, errors: allErrors, warnings: allWarnings };
}
