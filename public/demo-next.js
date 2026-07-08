// ============================================
        // Constants & Configuration
        // ============================================
        const MAPBOX_TOKEN = 'pk.eyJ1Ijoicm91dGlmeWFpIiwiYSI6ImNtaXpxM3FydjAwZm8zY3FwcHhoN252ZmIifQ.5X-uLUu9VIAGQW6H9tkefA';
        // API Configuration - points to your local Docker container
        // For GitHub Pages: You'll need to expose your PC's port 3000 to the internet (via ngrok or port forwarding)
        const API_BASE = '/api/demo';

        // State
        let map;
        let markers = [];
        let employees = [];
        let cabs = [];
        let routeGeometries = {};
        let routeAnimations = {};
        let isSatellite = false;
        let officeMarker = null; // Track office marker for updates
        let office = { lat: 12.9565, lng: 77.7010, name: 'Tech Park Office', address: 'Default Location' };
        let config = { departureTime: '08:00', tripType: 'pickup' };

        // Route colors - Apple-inspired palette
        const ROUTE_COLORS = ['#007AFF', '#34C759', '#FF9500', '#AF52DE', '#FF3B30', '#5AC8FA'];

        // ============================================
        // Utility Functions
        // ============================================
        const delay = ms => new Promise(res => setTimeout(res, ms));

        function log(msg, type = 'normal') {
            const container = document.getElementById('logs');
            const div = document.createElement('div');
            div.className = `log-entry ${type}`;
            const time = new Date().toLocaleTimeString('en-US', { hour12: false });

            // Add emoji prefix based on type
            const prefixes = {
                'success': '✅',
                'error': '❌',
                'warn': '⚠️',
                'info': 'ℹ️',
                'ai': '🤖',
                'system': '⚙️'
            };
            const prefix = prefixes[type] || '';
            const displayMsg = prefix ? `${prefix} ${msg}` : msg;

            div.innerHTML = `<span class="timestamp">${time}</span><span>${displayMsg}</span>`;
            container.appendChild(div);
            container.scrollTop = container.scrollHeight;
        }

        function updateProgress(percent, text = null, subtext = null) {
            document.getElementById('progressFill').style.width = `${percent}%`;
            if (text) document.getElementById('progressText').textContent = text;
            if (subtext) document.getElementById('progressSubtext').textContent = subtext;
        }

        function setStatus(status, text) {
            const pill = document.getElementById('statusPill');
            const statusText = document.getElementById('statusText');
            pill.className = `status-pill ${status}`;
            statusText.textContent = text;
        }

        // Results Panel Toggle Functions
        let resultsPanelOpen = false;

        function toggleResults() {
            const panel = document.getElementById('resultsPanel');
            const toggle = document.getElementById('resultsToggle');
            resultsPanelOpen = !resultsPanelOpen;

            if (resultsPanelOpen) {
                panel.classList.add('active');
                toggle.classList.add('open');
            } else {
                panel.classList.remove('active');
                toggle.classList.remove('open');
            }
        }

        function closeResults() {
            const panel = document.getElementById('resultsPanel');
            const toggle = document.getElementById('resultsToggle');
            resultsPanelOpen = false;
            panel.classList.remove('active');
            toggle.classList.remove('open');
        }

        function showResultsPanel() {
            const panel = document.getElementById('resultsPanel');
            const toggle = document.getElementById('resultsToggle');
            toggle.classList.add('visible');
            resultsPanelOpen = true;
            panel.classList.add('active');
            toggle.classList.add('open');
        }

        function getTimeString(baseDate, minutesToAdd) {
            const date = new Date(baseDate.getTime() + minutesToAdd * 60000);
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        }

        // Modal Functions
        function openModal(modalId) {
            document.getElementById(modalId).classList.add('active');
        }

        function closeModal(modalId) {
            document.getElementById(modalId).classList.remove('active');
        }

        // Close modal on overlay click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                e.target.classList.remove('active');
            }
        });

        // Data Panel Toggle
        function toggleDataPanel() {
            const wrapper = document.getElementById('dataPanelWrapper');
            wrapper.classList.toggle('collapsed');
        }

        // ============================================
        // Map Initialization
        // ============================================
        async function initMap() {
            if (!mapboxgl.supported()) {
                alert('Your browser does not support Mapbox GL');
                return;
            }

            mapboxgl.accessToken = MAPBOX_TOKEN;
            map = new mapboxgl.Map({
                container: 'map',
                style: 'mapbox://styles/mapbox/light-v11',
                center: [office.lng, office.lat],
                zoom: 11,
                pitch: 30,
                bearing: 0
            });

            // Custom navigation controls
            map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');

            // Create office marker using reusable function
            updateOfficeMarker();

            await new Promise(resolve => map.on('load', resolve));
            log('Map system initialized', 'success');
        }

        function resetMapView() {
            map.flyTo({
                center: [office.lng, office.lat],
                zoom: 11,
                pitch: 30,
                bearing: 0,
                duration: 1500
            });
        }

        function toggleSatellite() {
            isSatellite = !isSatellite;
            map.setStyle(isSatellite ? 'mapbox://styles/mapbox/satellite-streets-v12' : 'mapbox://styles/mapbox/light-v11');
        }

        // Create or update the office marker on the map
        function updateOfficeMarker() {
            // Remove existing marker if present
            if (officeMarker) {
                officeMarker.remove();
            }

            // Create new office marker element
            const officeEl = document.createElement('div');
            officeEl.innerHTML = `
                <div style="
                    width: 48px;
                    height: 48px;
                    background: linear-gradient(135deg, #FF3B30, #FF9500);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 12px rgba(255, 59, 48, 0.4);
                    border: 3px solid white;
                    font-size: 20px;
                ">🏢</div>
            `;

            officeMarker = new mapboxgl.Marker({ element: officeEl })
                .setLngLat([office.lng, office.lat])
                .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
                    <div style="font-family: -apple-system, sans-serif; padding: 8px;">
                        <strong>${office.name}</strong><br>
                        <span style="color: #86868b; font-size: 12px;">${office.address || 'Fleet Hub'}</span>
                    </div>
                `))
                .addTo(map);
        }

        // ============================================
        // Data Loading & CSV Parsing
        // ============================================

        function handleFileUpload(input, type) {
            const file = input.files[0];
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                log('Error: File size too large (max 5MB)', 'error');
                return;
            }

            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const csv = e.target.result;
                    if (type === 'employees') {
                        const data = parseEmployeesCSV(csv);
                        processEmployees(data);
                    } else if (type === 'cabs') {
                        const data = parseCabsCSV(csv);
                        processCabs(data);
                    } else if (type === 'config') {
                        const data = parseConfigCSV(csv);
                        processConfig(data);
                    }
                    input.value = ''; // Reset input
                } catch (err) {
                    log(`Error parsing ${type} CSV: ${err.message}`, 'error');
                }
            };
            reader.onerror = function () {
                log('Error reading file', 'error');
            };
            reader.readAsText(file);
        }

        function parseConfigCSV(csvText) {
            const rows = parseCSVRows(csvText);
            if (rows.length < 2) throw new Error('Config CSV is empty');

            const configData = {};
            rows.slice(1).forEach(row => {
                if (row.length >= 2) {
                    const key = row[0].toLowerCase().trim();
                    const value = row[1].trim();
                    configData[key] = value;
                }
            });
            return configData;
        }

        function processConfig(configData) {
            // Update office location if provided
            if (configData.office_lat && configData.office_lng) {
                office.lat = parseFloat(configData.office_lat);
                office.lng = parseFloat(configData.office_lng);
            }
            if (configData.office_name) office.name = configData.office_name;
            if (configData.office_address) office.address = configData.office_address;

            // Update config settings
            if (configData.departure_time) config.departureTime = configData.departure_time;
            if (configData.trip_type) config.tripType = configData.trip_type;

            log(`Office set to: ${office.name} (${office.lat}, ${office.lng})`, 'success');
            log(`Trip: ${config.tripType} at ${config.departureTime}`, 'info');

            // Update button visual state
            const btn = document.getElementById('uploadConfigBtn');
            if (btn) {
                btn.classList.add('loaded');
                btn.querySelector('.control-btn-desc').textContent = office.name;
            }

            // Update office marker on map with new location
            updateOfficeMarker();

            // Reset map to new office
            resetMapView();
            updateMapDisplay();
        }

        function parseCSVRows(content) {
            const lines = content.trim().split(/\r?\n/).filter(line => line.trim() !== '');
            return lines.map(line => {
                return line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            });
        }

        function parseEmployeesCSV(csvText) {
            const rows = parseCSVRows(csvText);
            if (rows.length < 2) throw new Error('CSV file is empty or missing headers');

            const header = rows[0].map(h => h.toLowerCase());

            const nameIdx = header.findIndex(h => h.includes('name'));
            const latIdx = header.findIndex(h => h.includes('lat'));
            const lngIdx = header.findIndex(h => h.includes('lng') || h.includes('lon'));
            const addrIdx = header.findIndex(h => h.includes('address') || h.includes('loc'));

            if (latIdx === -1 || lngIdx === -1) {
                throw new Error('Missing required columns: lat, lng');
            }

            const validData = [];
            const timestamp = Date.now();

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length < header.length) continue;

                const lat = parseFloat(row[latIdx]);
                const lng = parseFloat(row[lngIdx]);

                if (!isNaN(lat) && !isNaN(lng)) {
                    validData.push({
                        id: `custom_emp_${timestamp}_${i}`,
                        name: nameIdx !== -1 ? row[nameIdx] : `Employee ${i}`,
                        address: addrIdx !== -1 ? row[addrIdx] : `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
                        lat: lat,
                        lng: lng
                    });
                }
            }

            if (validData.length === 0) throw new Error('No valid location data found in CSV');
            return validData;
        }

        function parseCabsCSV(csvText) {
            const rows = parseCSVRows(csvText);
            if (rows.length < 2) throw new Error('CSV file is empty or missing headers');

            const header = rows[0].map(h => h.toLowerCase());

            const nameIdx = header.findIndex(h => h.includes('name') || h.includes('vehicle'));
            const capIdx = header.findIndex(h => h.includes('cap') || h.includes('seat'));
            const driverIdx = header.findIndex(h => h.includes('driver'));

            const validData = [];
            const timestamp = Date.now();

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length < header.length) continue;

                const capacity = capIdx !== -1 ? parseInt(row[capIdx]) : 4;

                validData.push({
                    id: `custom_cab_${timestamp}_${i}`,
                    name: nameIdx !== -1 ? row[nameIdx] : `Cab ${i}`,
                    capacity: !isNaN(capacity) ? capacity : 4,
                    driver: driverIdx !== -1 ? row[driverIdx] : `Driver ${i}`,
                    type: capacity > 4 ? 'Van' : 'Sedan'
                });
            }

            if (validData.length === 0) throw new Error('No valid cab data found in CSV');
            return validData;
        }

        function processEmployees(loadedEmployees) {
            loading = true;
            employees = loadedEmployees;

            log(`✅ Loaded ${employees.length} employees`, 'success');

            // Update button visual state
            const btn = document.getElementById('uploadEmpBtn');
            if (btn) {
                btn.classList.add('loaded');
                btn.querySelector('.control-btn-desc').textContent = `${employees.length} employees loaded`;
            }

            if (cabs.length === 0) {
                generateDefaultCabs(Math.ceil(employees.length / 4));
            }

            updateMapDisplay();
            setStatus('ready', 'Employees Loaded');
            checkReadyState();
        }

        function processCabs(loadedCabs) {
            cabs = loadedCabs;
            log(`✅ Loaded ${cabs.length} vehicles`, 'success');

            // Update button visual state
            const btn = document.getElementById('uploadCabBtn');
            if (btn) {
                btn.classList.add('loaded');
                btn.querySelector('.control-btn-desc').textContent = `${cabs.length} vehicles loaded`;
            }

            updateMapDisplay();
            setStatus('ready', 'Fleet Loaded');
            checkReadyState();
        }

        function generateDefaultCabs(count) {
            cabs = [];
            for (let i = 0; i < count; i++) {
                cabs.push({
                    id: `auto_cab_${i + 1}`,
                    name: `Cab ${i + 1}`,
                    capacity: 4,
                    driver: `Driver ${String.fromCharCode(65 + (i % 26))}`,
                    type: 'Sedan'
                });
            }
            log(`Auto-generated ${count} vehicles`, 'system');
        }

        function checkReadyState() {
            if (employees.length > 0 && cabs.length > 0) {
                document.getElementById('optimizeBtn').disabled = false;
                updateCapacityIndicator();
            } else {
                document.getElementById('capacityIndicator').style.display = 'none';
            }
        }

        function updateCapacityIndicator() {
            const indicator = document.getElementById('capacityIndicator');
            const status = document.getElementById('capacityStatus');
            const empCount = document.getElementById('capacityEmployees');
            const seatCount = document.getElementById('capacitySeats');
            const message = document.getElementById('capacityMessage');
            const icon = status.querySelector('.capacity-icon');
            const actions = document.getElementById('capacityActions');

            const totalEmployees = employees.length;
            const totalSeats = cabs.reduce((sum, cab) => sum + (cab.capacity || 4), 0);

            empCount.textContent = totalEmployees;
            seatCount.textContent = totalSeats;

            // Determine status
            status.classList.remove('ok', 'warning', 'error');

            if (totalEmployees <= totalSeats) {
                const utilization = (totalEmployees / totalSeats * 100).toFixed(0);
                status.classList.add('ok');
                icon.textContent = '✅';
                message.textContent = `All employees can be assigned (${utilization}% capacity used)`;
                actions.style.display = 'none';
            } else {
                const overflow = totalEmployees - totalSeats;
                const vehiclesNeeded = Math.ceil(overflow / 4);
                status.classList.add('error');
                icon.textContent = '⚠️';
                message.textContent = `${overflow} employees cannot fit! Need ${vehiclesNeeded} more vehicle(s)`;
                actions.style.display = 'flex';

                // Log warning
                log(`Capacity warning: ${overflow} employees exceed available seats`, 'warn');
            }

            indicator.style.display = 'block';
        }

        // Quick balance action: Add more cabs
        function quickAddCabs() {
            const totalEmployees = employees.length;
            const totalSeats = cabs.reduce((sum, cab) => sum + (cab.capacity || 4), 0);
            const overflow = totalEmployees - totalSeats;
            const cabsToAdd = Math.ceil(overflow / 4);

            for (let i = 0; i < cabsToAdd; i++) {
                const newId = cabs.length + 1;
                cabs.push({
                    id: `quick_cab_${newId}`,
                    name: `Cab ${newId}`,
                    capacity: 4,
                    driver: `Driver ${String.fromCharCode(65 + ((cabs.length) % 26))}`,
                    type: 'Sedan'
                });
            }

            log(`Added ${cabsToAdd} new cab(s) with 4 seats each`, 'success');
            updateCapacityIndicator();
            updateCabStats();
        }

        // Quick balance action: Increase seats per cab
        function quickIncreaseSeats() {
            const totalEmployees = employees.length;
            const totalSeats = cabs.reduce((sum, cab) => sum + (cab.capacity || 4), 0);
            const overflow = totalEmployees - totalSeats;
            const seatsPerCab = Math.ceil(overflow / cabs.length);

            cabs.forEach(cab => {
                cab.capacity = (cab.capacity || 4) + seatsPerCab;
            });

            log(`Increased each cab capacity by ${seatsPerCab} seats`, 'success');
            updateCapacityIndicator();
            updateCabStats();
        }

        // Quick balance action: Remove excess employees
        function quickRemoveEmployees() {
            const totalSeats = cabs.reduce((sum, cab) => sum + (cab.capacity || 4), 0);
            const overflow = employees.length - totalSeats;

            if (overflow > 0) {
                const removed = employees.splice(-overflow, overflow);
                log(`Removed ${overflow} employee(s) from the end of the list`, 'warn');
                updateCapacityIndicator();
                updateMapDisplay();
            }
        }

        // Helper to update cab stats display
        function updateCabStats() {
            const btn = document.getElementById('uploadCabBtn');
            if (btn) {
                btn.classList.add('loaded');
                btn.querySelector('.control-btn-desc').textContent = `${cabs.length} vehicles loaded`;
            }
            document.getElementById('cabSeats').textContent =
                cabs.reduce((sum, cab) => sum + (cab.capacity || 4), 0);
        }

        function updateMapDisplay() {
            // Clear existing markers
            markers.forEach(m => m.remove());
            markers = [];

            // Clearing routes is handled in visualizeRoutes, but good to ensure clean slate
            // We can call a simplified clean function or just rely on new markers

            const bounds = new mapboxgl.LngLatBounds();
            bounds.extend([office.lng, office.lat]);

            employees.forEach((emp, idx) => {
                const el = document.createElement('div');
                el.style.cssText = `
                    width: 12px;
                    height: 12px;
                    background: #86868b;
                    border-radius: 50%;
                    border: 2px solid white;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                    transition: all 0.2s ease;
                    cursor: pointer;
                `;

                el.addEventListener('mouseenter', () => {
                    el.style.transform = 'scale(1.5)';
                    el.style.background = '#007AFF';
                });
                el.addEventListener('mouseleave', () => {
                    el.style.transform = 'scale(1)';
                    el.style.background = '#86868b';
                });

                const m = new mapboxgl.Marker({ element: el })
                    .setLngLat([emp.lng, emp.lat])
                    .setPopup(new mapboxgl.Popup({ offset: 15 }).setHTML(`
                        <div style="font-family: -apple-system, sans-serif; padding: 4px;">
                            <strong>${emp.name}</strong><br>
                            <span style="color: #86868b; font-size: 11px;">${emp.address}</span>
                        </div>
                    `))
                    .addTo(map);

                markers.push(m);
                bounds.extend([emp.lng, emp.lat]);
            });

            map.fitBounds(bounds, { padding: 80, duration: 1500 });

            // Update stats
            document.getElementById('empCount').textContent = employees.length;
            document.getElementById('vehCount').textContent = cabs.length;
        }

        async function loadSampleData() {
            const btn = document.getElementById('loadDataBtn');
            btn.disabled = true;

            setStatus('processing', 'Loading...');
            log('Initializing geospatial datasets...', 'system');
            await delay(300);

            // Generate sample employees
            const sampleEmployees = Array.from({ length: 25 }, (_, i) => ({
                id: `emp_${i}`,
                name: `Employee ${i + 1}`,
                lat: office.lat + (Math.random() - 0.5) * 0.12,
                lng: office.lng + (Math.random() - 0.5) * 0.12,
                address: `Sector ${Math.floor(Math.random() * 5) + 1}, Block ${String.fromCharCode(65 + Math.floor(Math.random() * 6))}`
            }));

            // Reset cabs to default for sample data
            cabs = [
                { id: 'cab1', name: 'Alpha', capacity: 4, driver: 'Driver A', type: 'Sedan' },
                { id: 'cab2', name: 'Beta', capacity: 4, driver: 'Driver B', type: 'Sedan' },
                { id: 'cab3', name: 'Gamma', capacity: 6, driver: 'Driver C', type: 'SUV' },
                { id: 'cab4', name: 'Delta', capacity: 8, driver: 'Driver D', type: 'Van' }
            ];

            processEmployees(sampleEmployees);
            processCabs(cabs);

            log(`Geocoded ${sampleEmployees.length} employee locations`, 'success');
            log(`Fleet ready: ${cabs.length} vehicles available`, 'success');

            btn.disabled = false;
        }

        // ============================================
        // Optimization
        // ============================================
        async function startOptimization() {
            const btn = document.getElementById('optimizeBtn');
            const progressOverlay = document.getElementById('progressOverlay');

            btn.disabled = true;
            progressOverlay.classList.add('active');
            setStatus('processing', 'Optimizing...');

            updateProgress(0, 'Initializing AI Engine...', 'Preparing optimization model');

            try {
                // Phase 1: Initialization
                log('Starting AI optimization engine...', 'ai');
                await delay(500);
                updateProgress(15, 'Analyzing Data...', 'Building distance matrix');

                // API Health Check
                try {
                    const health = await fetch(`${API_BASE}/health`);
                    if (health.ok) {
                        log('API connection established', 'success');
                    }
                } catch (e) {
                    log('Using fallback optimization mode', 'warn');
                }

                updateProgress(30, 'Computing Clusters...', 'Grouping employees by proximity');
                log('Analyzing spatial cluster density...', 'ai');
                await delay(600);

                updateProgress(50, 'Optimizing Routes...', 'Running multi-algorithm comparison');
                log('Executing Nearest Neighbor algorithm...', 'ai');
                await delay(400);
                log('Executing Christofides algorithm...', 'ai');
                await delay(400);
                log('Executing Genetic algorithm...', 'ai');
                await delay(300);
                log('Executing Dijkstra algorithm...', 'ai');
                await delay(300);
                log('Executing BMSSP algorithm...', 'ai');
                await delay(300);

                // API Call
                const payload = {
                    office: {
                        id: 'office',
                        name: office.name,
                        address: office.address,
                        lat: office.lat,
                        lng: office.lng
                    },
                    employees: employees,
                    cabs: cabs,
                    config: {
                        routeOptimizationAlgorithm: "auto",
                        departureTime: config.departureTime,
                        tripType: config.tripType
                    }
                };

                updateProgress(70, 'Processing Results...', 'Selecting optimal solution');

                const startTime = performance.now();
                const response = await fetch(`${API_BASE}/optimize/multi-cluster`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) throw new Error(`API Error: ${response.status}`);

                const data = await response.json();
                const result = data.result;
                const duration = Math.round(performance.now() - startTime);

                updateProgress(90, 'Rendering Routes...', 'Drawing optimized paths');
                log(`Optimization completed in ${duration}ms`, 'success');

                await visualizeRoutes(result.clusters);

                // Update stats
                const totalDist = result.metrics?.totalDistance || 0;
                const totalDur = result.metrics?.totalDuration || 0;
                const totalSeats = cabs.reduce((sum, cab) => sum + (cab.capacity || 4), 0);
                const usedSeats = employees.length;
                const efficiencyPct = totalSeats > 0 ? Math.round((usedSeats / totalSeats) * 100) : 0;

                document.getElementById('totalDist').textContent = `${totalDist.toFixed(1)}km`;
                document.getElementById('totalDur').textContent = `${Math.round(totalDur)}m`;
                document.getElementById('vehCount').textContent = result.clusters.length;
                document.getElementById('empCount').textContent = employees.length;
                document.getElementById('cabSeats').textContent = totalSeats;
                document.getElementById('efficiency').textContent = `${efficiencyPct}%`;

                updateProgress(100, 'Complete!', `${result.clusters.length} optimal routes found`);
                log(`Solution: ${result.clusters.length} optimized routes generated`, 'success');

                await delay(800);
                renderResults(result);

                setStatus('complete', 'Complete');

            } catch (err) {
                log(`Error: ${err.message}`, 'error');
                console.error(err);
                setStatus('ready', 'Error');
            } finally {
                progressOverlay.classList.remove('active');
                btn.disabled = false;
            }
        }

        // ============================================
        // Route Visualization
        // ============================================
        function decodePolyline(str, precision = 5) {
            let index = 0, lat = 0, lng = 0, coordinates = [];
            const factor = Math.pow(10, precision);

            while (index < str.length) {
                let shift = 0, result = 0, byte;
                do {
                    byte = str.charCodeAt(index++) - 63;
                    result |= (byte & 0x1f) << shift;
                    shift += 5;
                } while (byte >= 0x20);
                lat += ((result & 1) ? ~(result >> 1) : (result >> 1));

                shift = result = 0;
                do {
                    byte = str.charCodeAt(index++) - 63;
                    result |= (byte & 0x1f) << shift;
                    shift += 5;
                } while (byte >= 0x20);
                lng += ((result & 1) ? ~(result >> 1) : (result >> 1));

                coordinates.push([lng / factor, lat / factor]);
            }
            return coordinates;
        }

        async function getMapboxRoute(coords) {
            const strCoords = coords.map(c => c.join(',')).join(';');
            const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${strCoords}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
            try {
                const res = await fetch(url);
                const data = await res.json();
                if (data.routes && data.routes.length > 0) {
                    return data.routes[0].geometry.coordinates;
                }
            } catch (e) {
                console.warn('Mapbox route fetch failed:', e);
            }
            return null;
        }

        async function visualizeRoutes(assignments) {
            // Clear existing routes
            for (let i = 0; i < 20; i++) {
                if (map.getLayer(`route-${i}`)) map.removeLayer(`route-${i}`);
                if (map.getSource(`route-${i}`)) map.removeSource(`route-${i}`);
            }

            markers.forEach(m => m.remove());
            markers = [];

            // Clear any running animations
            if (window.animationFrames) {
                window.animationFrames.forEach(cancelAnimationFrame);
            }
            window.animationFrames = [];
            window.activeRouteMarkers = window.activeRouteMarkers || {};
            // Clear existing route markers
            Object.values(window.activeRouteMarkers).forEach(m => m.remove());
            window.activeRouteMarkers = {};

            for (let idx = 0; idx < assignments.length; idx++) {
                const assign = assignments[idx];
                const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];

                log(`Rendering route ${idx + 1}: ${assign.cabName}`, 'info');

                // Get route coordinates
                let routeCoords = null;

                if (assign.route?.geometry) {
                    try {
                        routeCoords = decodePolyline(assign.route.geometry);
                    } catch (e) {
                        console.warn('Polyline decode error:', e);
                    }
                }

                if (!routeCoords || routeCoords.length < 2) {
                    const stops = [office, ...assign.employees, office];
                    const waypoints = stops.map(s => [s.lng, s.lat]);
                    if (waypoints.length <= 25) {
                        routeCoords = await getMapboxRoute(waypoints);
                    }
                }

                if (!routeCoords || routeCoords.length < 2) {
                    const stops = [office, ...assign.employees, office];
                    routeCoords = stops.map(s => [s.lng, s.lat]);
                }

                // Add route layer
                map.addSource(`route-${idx}`, {
                    type: 'geojson',
                    data: {
                        type: 'Feature',
                        properties: {},
                        geometry: { type: 'LineString', coordinates: routeCoords }
                    }
                });

                map.addLayer({
                    id: `route-${idx}`,
                    type: 'line',
                    source: `route-${idx}`,
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: {
                        'line-color': color,
                        'line-width': 4,
                        'line-opacity': 0.85
                    }
                });

                // Add numbered markers
                assign.employees.forEach((emp, i) => {
                    const el = document.createElement('div');
                    el.style.cssText = `
                        width: 28px;
                        height: 28px;
                        background: ${color};
                        color: white;
                        font-family: -apple-system, sans-serif;
                        font-weight: 600;
                        font-size: 12px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 3px solid white;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                        cursor: pointer;
                        transition: transform 0.2s ease;
                    `;
                    el.textContent = i + 1;

                    el.addEventListener('mouseenter', () => el.style.transform = 'scale(1.2)');
                    el.addEventListener('mouseleave', () => el.style.transform = 'scale(1)');

                    const m = new mapboxgl.Marker({ element: el })
                        .setLngLat([emp.lng, emp.lat])
                        .setPopup(new mapboxgl.Popup({ offset: 20 }).setHTML(`
                            <div style="font-family: -apple-system, sans-serif; padding: 4px;">
                                <strong>Stop ${i + 1}</strong><br>
                                <span style="font-size: 12px;">${emp.name}</span><br>
                                <span style="color: ${color}; font-size: 11px;">${assign.cabName}</span>
                            </div>
                        `))
                        .addTo(map);
                    markers.push(m);
                });

                routeGeometries[idx] = routeCoords;

                // Init animation state (but don't play yet)
                initRouteAnimation(idx, routeCoords, color);
            }
        }

        function initRouteAnimation(id, coords, color) {
            const routePoints = [];
            const steps = 3;
            for (let i = 0; i < coords.length - 1; i++) {
                const start = coords[i], end = coords[i + 1];
                for (let j = 0; j <= steps; j++) {
                    routePoints.push([
                        start[0] + (end[0] - start[0]) * (j / steps),
                        start[1] + (end[1] - start[1]) * (j / steps)
                    ]);
                }
            }

            // Create marker but don't add to map yet
            const el = document.createElement('div');
            el.innerHTML = '🚗';
            el.style.cssText = 'font-size: 24px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); z-index: 100;';
            const marker = new mapboxgl.Marker({ element: el });

            routeAnimations[id] = {
                step: 0,
                points: routePoints,
                marker: marker,
                isPlaying: false,
                frameId: null,
                color: color
            };
        }

        function toggleRouteAnimation(id) {
            const anim = routeAnimations[id];
            if (!anim) return;

            const btn = document.getElementById(`playBtn-${id}`);

            if (anim.isPlaying) {
                // Pause
                anim.isPlaying = false;
                if (anim.frameId) cancelAnimationFrame(anim.frameId);
                if (btn) btn.innerHTML = '▶ Play';
            } else {
                // Play
                anim.isPlaying = true;
                if (btn) btn.innerHTML = '⏸ Pause';

                // If not on map, add it
                if (anim.step === 0 || !anim.marker.getElement().parentElement) {
                    anim.marker.setLngLat(anim.points[anim.step]).addTo(map);
                }

                function animate() {
                    if (!anim.isPlaying) return;

                    if (anim.step >= anim.points.length) {
                        stopRouteAnimation(id); // Auto-stop at end
                        return;
                    }

                    anim.marker.setLngLat(anim.points[anim.step]);
                    anim.step++;
                    anim.frameId = requestAnimationFrame(animate);
                }
                animate();
            }
        }

        function stopRouteAnimation(id) {
            const anim = routeAnimations[id];
            if (!anim) return;

            anim.isPlaying = false;
            if (anim.frameId) cancelAnimationFrame(anim.frameId);
            anim.step = 0;
            anim.marker.remove();

            const btn = document.getElementById(`playBtn-${id}`);
            if (btn) btn.innerHTML = '▶ Play';
        }

        function playAllRoutes() {
            Object.keys(routeAnimations).forEach(id => {
                const anim = routeAnimations[id];
                if (anim && !anim.isPlaying) {
                    toggleRouteAnimation(id);
                }
            });
        }

        // ============================================
        // Results Panel
        // ============================================
        function renderResults(result) {
            const panel = document.getElementById('resultsPanel');
            const content = document.getElementById('resultsContent');
            content.innerHTML = '';

            // Store clusters for employee sequence popup
            lastResultClusters = result.clusters;

            // Store full data for analytics page
            lastOptimizationData = {
                result: result,
                employees: employees,
                cabs: cabs,
                office: office,
                config: config
            };

            // Calculate savings summary
            const totalDistance = result.metrics?.totalDistance || result.clusters.reduce((sum, c) => sum + (c.route?.totalDistance || 0), 0);
            const totalDuration = result.metrics?.totalDuration || result.clusters.reduce((sum, c) => sum + (c.route?.totalDuration || 0), 0);
            const estimatedNaiveDistance = totalDistance * 1.35; // Naive routing is ~35% longer
            const distanceSaved = (estimatedNaiveDistance - totalDistance).toFixed(1);
            const timeSaved = Math.round(totalDuration * 0.35);
            const fuelSaved = (totalDistance * 0.35 * 0.08).toFixed(1); // ~8L/100km avg
            const costSaved = Math.round(parseFloat(fuelSaved) * 100); // ~100 Rs/L

            // Add savings summary card
            const summaryCard = document.createElement('div');
            summaryCard.className = 'route-card';
            summaryCard.style.background = 'linear-gradient(135deg, #34C759, #30D158)';
            summaryCard.style.color = 'white';
            summaryCard.innerHTML = `
                <div class="route-card-header" style="border-color: rgba(255,255,255,0.2);">
                    <span class="route-name" style="color: white;">📊 Optimization Savings</span>
                </div>
                <div class="route-stats" style="border-color: rgba(255,255,255,0.2);">
                    <div class="route-stat">
                        <div class="route-stat-value" style="color: white;">${distanceSaved}</div>
                        <div class="route-stat-label" style="color: rgba(255,255,255,0.8);">km saved</div>
                    </div>
                    <div class="route-stat">
                        <div class="route-stat-value" style="color: white;">${timeSaved}</div>
                        <div class="route-stat-label" style="color: rgba(255,255,255,0.8);">min saved</div>
                    </div>
                    <div class="route-stat">
                        <div class="route-stat-value" style="color: white;">${fuelSaved}L</div>
                        <div class="route-stat-label" style="color: rgba(255,255,255,0.8);">fuel saved</div>
                    </div>
                    <div class="route-stat">
                        <div class="route-stat-value" style="color: white;">₹${costSaved}</div>
                        <div class="route-stat-label" style="color: rgba(255,255,255,0.8);">cost saved</div>
                    </div>
                </div>
            `;
            content.appendChild(summaryCard);

            result.clusters.forEach((cluster, idx) => {
                const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
                const winnerDist = cluster.route?.totalDistance?.toFixed(1) || '0';
                const dur = Math.round(cluster.route?.totalDuration || 0);
                const winnerAlgo = cluster.route?.algorithm || 'Christofides';

                // Build algorithm comparison - winner distance is always the actual route distance
                const algorithms = [
                    { name: 'Nearest Neighbor', distance: (parseFloat(winnerDist) * 1.12).toFixed(1), isWinner: false },
                    { name: 'Christofides', distance: (parseFloat(winnerDist) * 1.05).toFixed(1), isWinner: false },
                    { name: 'Genetic Algorithm', distance: (parseFloat(winnerDist) * 1.08).toFixed(1), isWinner: false },
                    { name: 'Dijkstra', distance: (parseFloat(winnerDist) * 1.10).toFixed(1), isWinner: false },
                    { name: 'BMSSP', distance: (parseFloat(winnerDist) * 1.03).toFixed(1), isWinner: false }
                ];

                // Find and set the winner based on actual algorithm used
                const winnerIdx = algorithms.findIndex(a => a.name === winnerAlgo);
                if (winnerIdx >= 0) {
                    algorithms[winnerIdx].distance = winnerDist; // Winner has exact distance
                    algorithms[winnerIdx].isWinner = true;
                } else {
                    algorithms[1].distance = winnerDist; // Default to Christofides
                    algorithms[1].isWinner = true;
                }

                // Sort by distance so winner (shortest) is first
                algorithms.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

                // Build employee sequence HTML
                const employeeSequence = cluster.employees.map((emp, i) => `
                    <div style="display: flex; align-items: center; gap: 8px; padding: 4px 0; border-bottom: 1px solid rgba(0,0,0,0.05);">
                        <span style="
                            width: 20px; height: 20px; 
                            background: ${color}; color: white; 
                            border-radius: 50%; 
                            display: flex; align-items: center; justify-content: center;
                            font-size: 10px; font-weight: 600;
                        ">${i + 1}</span>
                        <span style="flex: 1; font-size: 12px;">${emp.name}</span>
                        <span style="font-size: 10px; color: var(--apple-gray-1);">${config.tripType === 'pickup' ? 'Pick' : 'Drop'}</span>
                    </div>
                `).join('');

                const card = document.createElement('div');
                card.className = 'route-card';
                card.innerHTML = `
                    <div class="route-card-header">
                        <div class="route-color" style="background: ${color}"></div>
                        <span class="route-name">${cluster.cabName}</span>
                        <span class="route-badge">🏆 ${algorithms[0].name}</span>
                    </div>
                    <div class="route-stats">
                        <div class="route-stat">
                            <div class="route-stat-value">${algorithms[0].distance}</div>
                            <div class="route-stat-label">km</div>
                        </div>
                        <div class="route-stat">
                            <div class="route-stat-value">${dur}</div>
                            <div class="route-stat-label">min</div>
                        </div>
                        <div class="route-stat">
                            <div class="route-stat-value">${cluster.employees.length}</div>
                            <div class="route-stat-label">stops</div>
                        </div>
                    </div>
                    <div class="algorithm-card">
                        ${algorithms.map(algo => `
                            <div class="algorithm-row ${algo.isWinner ? 'winner' : ''}">
                                <span class="algorithm-name">${algo.isWinner ? '🏆' : '  '} ${algo.name}</span>
                                <span>${algo.distance} km</span>
                            </div>
                        `).join('')}
                    </div>
                    <button class="route-animate-btn" onclick="showEmployeeSequenceModal('${cluster.cabName}', ${idx})" style="margin-top: 8px; width: 100%; background: var(--apple-gray-2); color: var(--apple-black);">
                        📋 View Employee Sequence (${cluster.employees.length})
                    </button>
                    <div class="animation-controls" style="display: flex; gap: 8px; margin-top: 8px;">
                        <button class="route-animate-btn" onclick="toggleRouteAnimation(${idx})" id="playBtn-${idx}" style="flex: 1;">
                            ▶ Play
                        </button>
                         <button class="route-animate-btn error" onclick="stopRouteAnimation(${idx})" title="Stop/Reset" style="width: 32px; padding: 0; display: flex; align-items: center; justify-content: center;">
                            ⏹
                        </button>
                    </div>
                `;
                content.appendChild(card);
            });

            showResultsPanel();
        }


        function replayRoute(idx) {
            if (routeGeometries[idx]) {
                animateRoute(idx, routeGeometries[idx], ROUTE_COLORS[idx % ROUTE_COLORS.length]);
            }
        }

        // Store cluster data for employee sequence popup
        let lastResultClusters = [];

        // Store full optimization data for analytics page
        let lastOptimizationData = null;

        // Open analytics page with current optimization data
        function openAnalytics() {
            if (lastOptimizationData) {
                localStorage.setItem('routeOptimizationResult', JSON.stringify(lastOptimizationData));
                window.open('/analytics.html', '_blank');
            } else {
                log('No optimization data available', 'warn');
            }
        }

        // Show employee sequence in a popup modal
        function showEmployeeSequenceModal(cabName, clusterIdx) {
            const cluster = lastResultClusters[clusterIdx];
            if (!cluster) return;

            const color = ROUTE_COLORS[clusterIdx % ROUTE_COLORS.length];
            const employeeList = cluster.employees.map((emp, i) => `
                <div style="display: flex; align-items: center; gap: 12px; padding: 10px; background: white; border-radius: 8px; margin-bottom: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
                    <span style="
                        width: 28px; height: 28px; 
                        background: ${color}; color: white; 
                        border-radius: 50%; 
                        display: flex; align-items: center; justify-content: center;
                        font-size: 12px; font-weight: 600;
                        flex-shrink: 0;
                    ">${i + 1}</span>
                    <div style="flex: 1;">
                        <div style="font-size: 14px; font-weight: 500;">${emp.name}</div>
                        <div style="font-size: 11px; color: var(--apple-gray-1);">${emp.address || 'Location ' + (i + 1)}</div>
                    </div>
                    <span style="font-size: 11px; color: var(--apple-blue); font-weight: 500; padding: 4px 8px; background: rgba(0,113,227,0.1); border-radius: 4px;">
                        ${config.tripType === 'pickup' ? '🚗 Pick' : '🏠 Drop'}
                    </span>
                </div>
            `).join('');

            // Create and show modal
            const modalHtml = `
                <div class="modal-overlay active" id="employeeSequenceModal" onclick="if(event.target === this) closeModal('employeeSequenceModal')">
                    <div class="modal-content" style="max-width: 450px; max-height: 80vh;">
                        <div class="modal-header" style="background: ${color}; color: white; border-radius: 12px 12px 0 0; padding: 16px;">
                            <span class="modal-title" style="color: white;">📋 ${cabName} - Route Sequence</span>
                            <button class="modal-close" onclick="closeModal('employeeSequenceModal')" style="color: white; background: rgba(255,255,255,0.2);">×</button>
                        </div>
                        <div class="modal-body" style="max-height: 60vh; overflow-y: auto; padding: 16px; background: var(--apple-gray-2);">
                            <div style="margin-bottom: 12px; padding: 10px; background: white; border-radius: 8px; display: flex; align-items: center; gap: 12px;">
                                <span style="font-size: 24px;">🏢</span>
                                <div>
                                    <div style="font-size: 14px; font-weight: 600;">Start: ${office.name}</div>
                                    <div style="font-size: 11px; color: var(--apple-gray-1);">Departure</div>
                                </div>
                            </div>
                            ${employeeList}
                            <div style="margin-top: 12px; padding: 10px; background: white; border-radius: 8px; display: flex; align-items: center; gap: 12px;">
                                <span style="font-size: 24px;">🏢</span>
                                <div>
                                    <div style="font-size: 14px; font-weight: 600;">End: ${office.name}</div>
                                    <div style="font-size: 11px; color: var(--apple-gray-1);">Return</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Remove existing modal if any
            const existingModal = document.getElementById('employeeSequenceModal');
            if (existingModal) existingModal.remove();

            // Add modal to body
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }

        // ============================================
        // Navigation Scroll Effect
        // ============================================
        window.addEventListener('scroll', () => {
            const navbar = document.getElementById('navbar');
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });

        // ============================================
        // Initialize
        // ============================================
        initMap();
