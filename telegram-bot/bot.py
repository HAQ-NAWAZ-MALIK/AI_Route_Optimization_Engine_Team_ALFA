"""
AI Route Optimizer - Telegram Bot (Enhanced with Maps)
=======================================================
A Telegram bot with map visualization for route optimization.
Features: Sample data, CSV upload, route optimization, static map images.
"""

import os
import csv
import json
import logging
import requests
import urllib.parse
from io import StringIO, BytesIO
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, InputMediaPhoto
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ContextTypes,
    filters,
)

# ============================================================================
# CONFIGURATION
# ============================================================================
BOT_TOKEN = "8569114251:AAFZOmg9XZkB4V21hcSzZFTNMGfCm0vPQgw"
API_BASE_URL = "http://localhost:3000/api/v1"
MAPBOX_TOKEN = "pk.eyJ1Ijoicm91dGlmeWFpIiwiYSI6ImNtaXpxM3FydjAwZm8zY3FwcHhoN252ZmIifQ.5X-uLUu9VIAGQW6H9tkefA"

# Logging setup
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Colors for routes
ROUTE_COLORS = ['6366f1', '22c55e', 'f59e0b', 'ef4444', '8b5cf6', '06b6d4']

# ============================================================================
# SAMPLE DATA - Kashmir (Iqusar Company)
# ============================================================================
SAMPLE_OFFICE = {
    "id": "office",
    "name": "Iqusar Company HQ",
    "lat": 34.0837,  # Srinagar, Kashmir
    "lng": 74.7973
}

SAMPLE_EMPLOYEES = [
    # Srinagar Area
    {"id": "emp1", "name": "Aaqib Malik", "lat": 34.0911, "lng": 74.8026},      # Lal Chowk
    {"id": "emp2", "name": "Firdous Bhat", "lat": 34.0745, "lng": 74.8088},     # Dal Gate
    {"id": "emp3", "name": "Irfan Sheikh", "lat": 34.1056, "lng": 74.8153},     # Rainawari
    {"id": "emp4", "name": "Mehreen Wani", "lat": 34.0680, "lng": 74.7890},     # Jawahar Nagar
    # Outskirts
    {"id": "emp5", "name": "Waseem Dar", "lat": 34.1234, "lng": 74.8456},       # Nishat
    {"id": "emp6", "name": "Sabiya Lone", "lat": 34.1389, "lng": 74.8623},      # Shalimar
    {"id": "emp7", "name": "Adil Mir", "lat": 34.0520, "lng": 74.7650},         # Bemina
    {"id": "emp8", "name": "Rukhsana Parray", "lat": 34.0356, "lng": 74.7789},  # Pantha Chowk
    # Extended Areas
    {"id": "emp9", "name": "Bilal Rather", "lat": 34.1567, "lng": 74.8234},     # Hazratbal
    {"id": "emp10", "name": "Nazia Ganie", "lat": 34.0478, "lng": 74.8234},     # Rajbagh
]

SAMPLE_CABS = [
    {"id": "cab1", "name": "Innova 1", "capacity": 6},
    {"id": "cab2", "name": "Innova 2", "capacity": 6},
    {"id": "cab3", "name": "Swift Dzire", "capacity": 4},
]

user_data_store = {}

# ============================================================================
# MAP GENERATION FUNCTIONS
# ============================================================================

def calculate_center(clusters, office):
    """Calculate center point and appropriate zoom for all routes."""
    all_lats = [office['lat']]
    all_lngs = [office['lng']]
    
    for cluster in clusters:
        for emp in cluster.get("employees", []):
            all_lats.append(emp['lat'])
            all_lngs.append(emp['lng'])
    
    center_lat = sum(all_lats) / len(all_lats)
    center_lng = sum(all_lngs) / len(all_lngs)
    
    # Calculate span to determine zoom
    lat_span = max(all_lats) - min(all_lats)
    lng_span = max(all_lngs) - min(all_lngs)
    max_span = max(lat_span, lng_span)
    
    # Determine zoom level (higher = more zoomed in)
    # ~13 = 3-5km view, ~14 = 2-3km view
    if max_span < 0.05:
        zoom = 14  # Very close, ~2km
    elif max_span < 0.1:
        zoom = 13  # Close, ~3-4km
    elif max_span < 0.2:
        zoom = 12  # Medium, ~5-6km
    else:
        zoom = 11  # Wide, ~10km
    
    return center_lat, center_lng, zoom


def generate_static_map_url(clusters, office):
    """Generate Mapbox Static Map URL with actual road routes (~3km zoom)."""
    markers = []
    paths = []
    
    # Calculate center and zoom
    center_lat, center_lng, zoom = calculate_center(clusters, office)
    logger.info(f"Map center: {center_lat:.4f},{center_lng:.4f} zoom:{zoom}")
    
    # Office marker (red building icon)
    markers.append(f"pin-l-building+ff0000({office['lng']},{office['lat']})")
    
    for i, cluster in enumerate(clusters):
        color = ROUTE_COLORS[i % len(ROUTE_COLORS)]
        employees = cluster.get("employees", [])
        route = cluster.get("route", {})
        stops = route.get("stops", [])
        geometry = route.get("geometry")
        
        # Add employee markers with numbers
        for j, emp in enumerate(employees):
            markers.append(f"pin-s-{j+1}+{color}({emp['lng']},{emp['lat']})")
        
        # Add route path - use encoded polyline from API for real road routes
        if geometry:
            encoded_path = urllib.parse.quote(geometry, safe='')
            paths.append(f"path-5+{color}-0.9({encoded_path})")
            logger.info(f"Cluster {i+1}: Real road route ({len(geometry)} chars)")
        elif stops and len(stops) > 0:
            # Fallback: connect stops with lines
            coords = [f"{office['lng']},{office['lat']}"]
            for stop in stops:
                loc = stop.get("location", {})
                if loc.get("lat") and loc.get("lng"):
                    coords.append(f"{loc['lng']},{loc['lat']}")
            coords.append(f"{office['lng']},{office['lat']}")  # Return to office
            if len(coords) > 2:
                path_coords = ";".join(coords)
                paths.append(f"path-4+{color}-0.8({path_coords})")
                logger.info(f"Cluster {i+1}: Stop-based route ({len(coords)} points)")
        elif employees:
            # Last fallback: employee locations loop
            coords = [f"{office['lng']},{office['lat']}"]
            for emp in employees:
                coords.append(f"{emp['lng']},{emp['lat']}")
            coords.append(f"{office['lng']},{office['lat']}")
            path_coords = ";".join(coords)
            paths.append(f"path-3+{color}-0.7({path_coords})")
            logger.info(f"Cluster {i+1}: Employee fallback route")
    
    # Build URL with specific center and zoom instead of auto
    overlays = ",".join(paths + markers)
    map_url = f"https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/{overlays}/{center_lng},{center_lat},{zoom},0/800x600@2x?access_token={MAPBOX_TOKEN}&padding=50"
    
    logger.info(f"Map URL: {len(map_url)} chars")
    return map_url


def generate_google_maps_url(cluster, office):
    """Generate Google Maps Directions URL for a cluster route loop."""
    employees = cluster.get("employees", [])
    route = cluster.get("route", {})
    stops = route.get("stops", [])
    
    # Google Maps format: /origin/waypoint1/waypoint2/.../destination/
    waypoints = []
    
    # Start from office
    waypoints.append(f"{office['lat']},{office['lng']}")
    
    # Add stops in optimized order (from API)
    if stops and len(stops) > 0:
        for stop in stops:
            loc = stop.get("location", {})
            if loc.get("lat") and loc.get("lng"):
                # Skip if this is the office (first/last stop)
                if loc.get("id") != "office":
                    waypoints.append(f"{loc['lat']},{loc['lng']}")
    else:
        # Fallback: use employee locations
        for emp in employees:
            waypoints.append(f"{emp['lat']},{emp['lng']}")
    
    # End at office (return trip)
    waypoints.append(f"{office['lat']},{office['lng']}")
    
    # Build Google Maps URL
    base_url = "https://www.google.com/maps/dir/"
    route_url = base_url + "/".join(waypoints)
    
    logger.info(f"Google Maps URL: {len(waypoints)} waypoints")
    return route_url



async def download_map_image(url):
    """Download map image and return as bytes."""
    try:
        response = requests.get(url, timeout=15)
        if response.status_code == 200:
            return BytesIO(response.content)
        else:
            logger.error(f"Map API error: {response.status_code}")
            return None
    except Exception as e:
        logger.error(f"Error downloading map: {e}")
        return None


# ============================================================================
# COMMAND HANDLERS
# ============================================================================

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send welcome message with options."""
    logger.info(f"User {update.effective_user.id} started the bot")
    
    keyboard = [
        [InlineKeyboardButton("🚀 Run Kashmir Demo", callback_data="sample")],
        [InlineKeyboardButton("🧪 Test All APIs", callback_data="test_apis")],
        [InlineKeyboardButton("📤 Upload CSV", callback_data="upload"),
         InlineKeyboardButton("📊 View Data", callback_data="view_sample")],
        [InlineKeyboardButton("🗺️ Test Map", callback_data="test_map"),
         InlineKeyboardButton("❓ Help", callback_data="help")],
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "🚕 *AI Route Optimizer - Iqusar Company*\n\n"
        "Kashmir-based transport route optimization.\n\n"
        "*Features:*\n"
        "• 🧠 Multi-algorithm optimization\n"
        "• 🗺️ Real road route maps\n"
        "• 📍 Google Maps directions\n"
        "• 📊 Distance matrix calculation\n\n"
        "_Powered by AI Transport Optimizer API_",
        parse_mode="Markdown",
        reply_markup=reply_markup
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Show help information."""
    help_text = """
🚕 *AI Route Optimizer Bot - Help*

*Commands:*
/start - Start the bot
/sample - Run optimization with sample data
/status - Check API status
/optimize - Optimize uploaded data
/help - Show this help

*CSV Format:*

📄 *employees.csv:*
```
id,name,lat,lng
emp1,Alice,34.0625,-118.3050
```

📄 *cabs.csv:*
```
id,name,capacity
cab1,Cab Alpha,4
```

*Results include:*
• 📊 Cluster assignments
• 📏 Total distance & duration
• 🗺️ Static map image
• 🔗 Google Maps links
"""
    logger.info(f"User {update.effective_user.id} requested help")
    await update.message.reply_text(help_text, parse_mode="Markdown")


async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle button callbacks."""
    query = update.callback_query
    await query.answer()
    
    logger.info(f"Button callback: {query.data}")
    
    if query.data == "sample":
        await run_sample_optimization(query, context)
    elif query.data == "test_apis":
        await test_all_apis(query, context)
    elif query.data == "upload":
        await query.edit_message_text(
            "📤 *Upload Your Data*\n\n"
            "Send two CSV files:\n\n"
            "1️⃣ *employees.csv*: `id,name,lat,lng`\n"
            "2️⃣ *cabs.csv*: `id,name,capacity`\n\n"
            "_Send files one by one_",
            parse_mode="Markdown"
        )
    elif query.data == "view_sample":
        await show_sample_data(query)
    elif query.data == "test_map":
        await test_map(query, context)
    elif query.data == "help":
        await query.edit_message_text(
            "❓ *Help*\n\nUse /help command for detailed instructions.",
            parse_mode="Markdown"
        )
    elif query.data.startswith("route_"):
        route_index = int(query.data.split("_")[1])
        await show_route_detail(query, context, route_index)


async def test_map(query, context):
    """Test map generation with sample data."""
    await query.edit_message_text("🗺️ Generating test map...")
    
    # Create a simple test cluster
    test_clusters = [{
        "cabName": "Test Cab",
        "employees": SAMPLE_EMPLOYEES[:3],
        "route": {"stops": []}
    }]
    
    map_url = generate_static_map_url(test_clusters, SAMPLE_OFFICE)
    logger.info(f"Test map URL: {map_url[:100]}...")
    
    map_image = await download_map_image(map_url)
    
    if map_image:
        await context.bot.send_photo(
            chat_id=query.message.chat_id,
            photo=map_image,
            caption="🗺️ *Test Map Generated!*\n\n"
                   "Red pin = Iqusar Company HQ\n"
                   "Numbered pins = Employees\n\n"
                   "_Map visualization working!_",
            parse_mode="Markdown"
        )
    else:
        await context.bot.send_message(
            chat_id=query.message.chat_id,
            text="❌ Could not generate map. Check Mapbox token.",
            parse_mode="Markdown"
        )


async def test_all_apis(query, context):
    """Test all API endpoints and report results."""
    logger.info("Testing all API endpoints...")
    
    await query.edit_message_text(
        "🧪 *Testing All API Endpoints...*\n\n"
        "⏳ Running tests...",
        parse_mode="Markdown"
    )
    
    results = []
    
    # Test 1: Health Check
    try:
        resp = requests.get(f"{API_BASE_URL}/health", timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            results.append(f"✅ *Health*: {data.get('status', 'ok')}")
        else:
            results.append(f"❌ *Health*: HTTP {resp.status_code}")
    except Exception as e:
        results.append(f"❌ *Health*: {str(e)[:50]}")
    
    # Test 2: Algorithms
    try:
        resp = requests.get(f"{API_BASE_URL}/algorithms", timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            algos = data.get('algorithms', [])
            results.append(f"✅ *Algorithms*: {len(algos)} available")
        else:
            results.append(f"❌ *Algorithms*: HTTP {resp.status_code}")
    except Exception as e:
        results.append(f"❌ *Algorithms*: {str(e)[:50]}")
    
    # Test 3: Single Route Optimization
    try:
        payload = {
            "origin": SAMPLE_OFFICE,
            "destinations": SAMPLE_EMPLOYEES[:3],
            "tripType": "pickup",
            "constraints": {"departureTime": "08:00"},
            "options": {"algorithm": "auto"}
        }
        resp = requests.post(
            f"{API_BASE_URL}/optimize/route",
            json=payload,
            headers={"X-API-Key": "ropt_AoRRuGdzomZvq4YKWWLfDXXze0dCiFNG"},
            timeout=15
        )
        if resp.status_code == 200:
            data = resp.json()
            route = data.get('primaryRoute', {})
            dist = route.get('totalDistance', 0)
            results.append(f"✅ *Single Route*: {dist:.2f} km")
        else:
            results.append(f"❌ *Single Route*: HTTP {resp.status_code}")
    except Exception as e:
        results.append(f"❌ *Single Route*: {str(e)[:50]}")
    
    # Test 4: Multi-Cluster Optimization
    try:
        payload = {
            "office": SAMPLE_OFFICE,
            "employees": SAMPLE_EMPLOYEES[:6],
            "cabs": SAMPLE_CABS[:2],
            "config": {"routeOptimizationAlgorithm": "auto"}
        }
        resp = requests.post(
            f"{API_BASE_URL}/optimize/multi-cluster",
            json=payload,
            headers={"X-API-Key": "ropt_AoRRuGdzomZvq4YKWWLfDXXze0dCiFNG"},
            timeout=30
        )
        if resp.status_code == 200:
            data = resp.json()
            clusters = data.get('result', {}).get('clusters', [])
            results.append(f"✅ *Multi-Cluster*: {len(clusters)} clusters")
        else:
            results.append(f"❌ *Multi-Cluster*: HTTP {resp.status_code}")
    except Exception as e:
        results.append(f"❌ *Multi-Cluster*: {str(e)[:50]}")
    
    # Test 5: Distance Matrix
    try:
        # Use coordinates format: [{lat, lng}, ...]
        coords = [{"lat": loc['lat'], "lng": loc['lng']} for loc in [SAMPLE_OFFICE] + SAMPLE_EMPLOYEES[:3]]
        payload = {"coordinates": coords}
        resp = requests.post(
            f"{API_BASE_URL}/matrix/distance",
            json=payload,
            headers={"X-API-Key": "ropt_AoRRuGdzomZvq4YKWWLfDXXze0dCiFNG"},
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            distances = data.get('distances', [])
            results.append(f"✅ *Distance Matrix*: {len(distances)}x{len(distances)} matrix")
        else:
            results.append(f"❌ *Distance Matrix*: HTTP {resp.status_code}")
    except Exception as e:
        results.append(f"❌ *Distance Matrix*: {str(e)[:50]}")
    
    # Count passed
    passed = sum(1 for r in results if r.startswith("✅"))
    total = len(results)
    
    msg = f"🧪 *API Test Results: {passed}/{total} Passed*\n\n"
    msg += "\n".join(results)
    msg += f"\n\n🔗 API: `{API_BASE_URL}`"
    
    await context.bot.send_message(
        chat_id=query.message.chat_id,
        text=msg,
        parse_mode="Markdown"
    )
    logger.info(f"API tests complete: {passed}/{total} passed")


async def show_sample_data(query):
    """Display sample data."""
    emp_list = "\n".join([f"  • {e['name']}" for e in SAMPLE_EMPLOYEES[:5]])
    cab_list = "\n".join([f"  • {c['name']} (cap: {c['capacity']})" for c in SAMPLE_CABS])
    
    await query.edit_message_text(
        f"📊 *Iqusar Company - Sample Data*\n\n"
        f"🏢 *Office:* {SAMPLE_OFFICE['name']}\n"
        f"   📍 Srinagar, Kashmir\n\n"
        f"👥 *Employees ({len(SAMPLE_EMPLOYEES)}):*\n{emp_list}\n   ...and 5 more\n\n"
        f"🚕 *Cabs ({len(SAMPLE_CABS)}):*\n{cab_list}\n\n"
        f"_Use /sample to run optimization_",
        parse_mode="Markdown"
    )


async def run_sample_optimization(query, context):
    """Run optimization with sample data."""
    start_time = datetime.now()
    logger.info("Starting sample optimization...")
    
    await query.edit_message_text(
        "⏳ *Processing...*\n\n"
        "🔄 Step 1/3: Calling AI Route Optimizer API...",
        parse_mode="Markdown"
    )
    
    # Call the API
    result = await call_optimization_api(SAMPLE_OFFICE, SAMPLE_EMPLOYEES, SAMPLE_CABS)
    
    if result["success"]:
        await query.edit_message_text(
            "⏳ *Processing...*\n\n"
            "✅ Step 1/3: API call complete\n"
            "🔄 Step 2/3: Generating map...",
            parse_mode="Markdown"
        )
        
        # Store result for route details
        context.user_data['last_result'] = result
        context.user_data['office'] = SAMPLE_OFFICE
        
        # Generate and send results with map
        await send_results_with_map(query, context, result, SAMPLE_OFFICE)
        
        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(f"Optimization complete in {elapsed:.2f}s")
    else:
        logger.error(f"Optimization failed: {result.get('error')}")
        await query.edit_message_text(
            f"❌ *Optimization Failed*\n\n"
            f"Error: {result.get('error', 'Unknown error')}\n\n"
            f"_Make sure the API server is running on {API_BASE_URL}_",
            parse_mode="Markdown"
        )


async def call_optimization_api(office, employees, cabs):
    """Call the multi-cluster optimization API."""
    try:
        payload = {
            "office": office,
            "employees": employees,
            "cabs": cabs,
            "config": {"routeOptimizationAlgorithm": "auto"}
        }
        
        logger.info(f"API Request: {len(employees)} employees, {len(cabs)} cabs")
        
        response = requests.post(
            f"{API_BASE_URL}/optimize/multi-cluster",
            json=payload,
            headers={
                "Content-Type": "application/json",
                "X-API-Key": "ropt_AoRRuGdzomZvq4YKWWLfDXXze0dCiFNG"
            },
            timeout=120
        )
        
        logger.info(f"API Response: {response.status_code}")
        
        if response.status_code == 200:
            return response.json()
        else:
            return {"success": False, "error": f"HTTP {response.status_code}"}
    
    except requests.exceptions.ConnectionError:
        logger.error("API connection failed")
        return {"success": False, "error": "Cannot connect to API server"}
    except Exception as e:
        logger.error(f"API error: {e}")
        return {"success": False, "error": str(e)}


async def send_results_with_map(query, context, result, office):
    """Send results with map visualization."""
    data = result.get("result", {})
    clusters = data.get("clusters", [])
    metrics = data.get("metrics", {})
    processing_time = result.get("processingTimeMs", 0)
    
    # Generate map
    map_url = generate_static_map_url(clusters, office)
    map_image = await download_map_image(map_url)
    
    # Build summary message
    msg = "✅ *Route Optimization Complete!*\n\n"
    msg += f"⏱️ API Time: {processing_time:.0f}ms\n"
    msg += f"📊 Clusters: {len(clusters)}\n"
    msg += f"📏 Total Distance: {metrics.get('totalDistance', 0):.2f} km\n"
    msg += f"⏰ Total Duration: {metrics.get('totalDuration', 0):.0f} min\n"
    msg += f"📈 Avg Load: {metrics.get('averageLoadFactor', 0)*100:.0f}%\n\n"
    msg += "━━━━━━━━━━━━━━━━━━━━━\n\n"
    
    # Cluster summary with map links
    for i, cluster in enumerate(clusters):
        cab_name = cluster.get("cabName", f"Cab {i+1}")
        emp_list = cluster.get("employees", [])
        route = cluster.get("route", {})
        
        color_emoji = ["🟣", "🟢", "🟡", "🔴", "🟤", "🔵"][i % 6]
        
        msg += f"{color_emoji} *{cab_name}*\n"
        msg += f"   👥 {len(emp_list)} passengers\n"
        
        for emp in emp_list:
            msg += f"      • {emp.get('name', emp.get('id'))}\n"
        
        distance = route.get("totalDistance", 0)
        duration = route.get("totalDuration", 0)
        msg += f"   📏 {distance:.1f} km | ⏱️ {duration:.0f} min\n"
        
        # Google Maps link
        gmaps_url = generate_google_maps_url(cluster, office)
        msg += f"   🗺️ [Open in Google Maps]({gmaps_url})\n\n"
    
    # Send map image with caption
    if map_image:
        await context.bot.send_photo(
            chat_id=query.message.chat_id,
            photo=map_image,
            caption=msg,
            parse_mode="Markdown"
        )
    else:
        # Fallback to text only
        await query.edit_message_text(msg, parse_mode="Markdown", disable_web_page_preview=True)


async def sample_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Run sample optimization from command."""
    logger.info(f"User {update.effective_user.id} requested /sample")
    
    msg = await update.message.reply_text(
        "⏳ *Processing...*\n\n"
        "🔄 Running AI Route Optimization...",
        parse_mode="Markdown"
    )
    
    result = await call_optimization_api(SAMPLE_OFFICE, SAMPLE_EMPLOYEES, SAMPLE_CABS)
    
    if result["success"]:
        context.user_data['last_result'] = result
        context.user_data['office'] = SAMPLE_OFFICE
        
        # Delete loading message
        await msg.delete()
        
        # Send results
        await send_results_message_with_map(update, context, result, SAMPLE_OFFICE)
    else:
        await msg.edit_text(
            f"❌ *Optimization Failed*\n\nError: {result.get('error')}",
            parse_mode="Markdown"
        )


async def send_results_message_with_map(update, context, result, office):
    """Send results as new message with map."""
    data = result.get("result", {})
    clusters = data.get("clusters", [])
    metrics = data.get("metrics", {})
    processing_time = result.get("processingTimeMs", 0)
    
    # Generate map
    map_url = generate_static_map_url(clusters, office)
    map_image = await download_map_image(map_url)
    
    # Build message
    msg = "✅ *Route Optimization Complete!*\n\n"
    msg += f"⏱️ {processing_time:.0f}ms | 📊 {len(clusters)} clusters\n"
    msg += f"📏 {metrics.get('totalDistance', 0):.1f} km total\n\n"
    
    for i, cluster in enumerate(clusters):
        cab_name = cluster.get("cabName", f"Cab {i+1}")
        emp_list = cluster.get("employees", [])
        route = cluster.get("route", {})
        
        color_emoji = ["🟣", "🟢", "🟡", "🔴"][i % 4]
        msg += f"{color_emoji} *{cab_name}* ({len(emp_list)} pax)\n"
        
        for emp in emp_list:
            msg += f"   • {emp.get('name', emp.get('id'))}\n"
        
        msg += f"   📏 {route.get('totalDistance', 0):.1f} km\n\n"
    
    if map_image:
        await update.message.reply_photo(
            photo=map_image,
            caption=msg,
            parse_mode="Markdown"
        )
    else:
        await update.message.reply_text(msg, parse_mode="Markdown")


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Check API status."""
    logger.info(f"User {update.effective_user.id} checking status")
    
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            await update.message.reply_text(
                f"✅ *API Status: Online*\n\n"
                f"🔹 Status: {data.get('status', 'ok')}\n"
                f"🔹 Uptime: {data.get('uptime', 0):.0f}s\n"
                f"🔹 URL: `{API_BASE_URL}`\n\n"
                f"🔹 Mapbox: {'✅' if MAPBOX_TOKEN else '❌'}",
                parse_mode="Markdown"
            )
        else:
            await update.message.reply_text(f"⚠️ API returned HTTP {response.status_code}")
    except Exception as e:
        logger.error(f"Status check failed: {e}")
        await update.message.reply_text(
            f"❌ *API Offline*\n\nError: {str(e)[:100]}",
            parse_mode="Markdown"
        )


async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle uploaded CSV files."""
    document = update.message.document
    user_id = update.effective_user.id
    
    logger.info(f"User {user_id} uploaded: {document.file_name}")
    
    if not document.file_name.endswith('.csv'):
        await update.message.reply_text("⚠️ Please upload a CSV file.")
        return
    
    file = await context.bot.get_file(document.file_id)
    file_content = await file.download_as_bytearray()
    content = file_content.decode('utf-8')
    
    if user_id not in user_data_store:
        user_data_store[user_id] = {"employees": None, "cabs": None}
    
    try:
        reader = csv.DictReader(StringIO(content))
        rows = list(reader)
        
        if 'capacity' in rows[0]:
            cabs = [{"id": r['id'], "name": r.get('name', r['id']), "capacity": int(r['capacity'])} for r in rows]
            user_data_store[user_id]["cabs"] = cabs
            await update.message.reply_text(
                f"✅ *Cabs loaded!* ({len(cabs)} cabs)\n\n"
                f"_Send employees.csv or use /optimize_",
                parse_mode="Markdown"
            )
        else:
            employees = [{"id": r['id'], "name": r.get('name', r['id']), "lat": float(r['lat']), "lng": float(r['lng'])} for r in rows]
            user_data_store[user_id]["employees"] = employees
            await update.message.reply_text(
                f"✅ *Employees loaded!* ({len(employees)} employees)\n\n"
                f"_Send cabs.csv or use /optimize_",
                parse_mode="Markdown"
            )
        
        if user_data_store[user_id]["employees"] and user_data_store[user_id]["cabs"]:
            await update.message.reply_text(
                "📊 *All data ready!*\n\nUse /optimize to run.",
                parse_mode="Markdown"
            )
    
    except Exception as e:
        logger.error(f"CSV parse error: {e}")
        await update.message.reply_text(f"❌ Error: {str(e)}")


async def optimize_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Run optimization with uploaded data."""
    user_id = update.effective_user.id
    
    if user_id not in user_data_store or not user_data_store[user_id].get("employees"):
        await update.message.reply_text("⚠️ No data. Use /sample or upload CSV files.")
        return
    
    employees = user_data_store[user_id]["employees"]
    cabs = user_data_store[user_id].get("cabs", SAMPLE_CABS)
    
    logger.info(f"User {user_id} optimizing: {len(employees)} emp, {len(cabs)} cabs")
    
    msg = await update.message.reply_text("⏳ Optimizing...")
    
    result = await call_optimization_api(SAMPLE_OFFICE, employees, cabs)
    
    if result["success"]:
        await msg.delete()
        await send_results_message_with_map(update, context, result, SAMPLE_OFFICE)
    else:
        await msg.edit_text(f"❌ Failed: {result.get('error')}")


# ============================================================================
# MAIN
# ============================================================================

def main():
    """Start the bot."""
    print("[BOT] Starting AI Route Optimizer Telegram Bot...")
    print(f"[API] URL: {API_BASE_URL}")
    print(f"[MAP] Mapbox: {'Configured' if MAPBOX_TOKEN else 'Not configured'}")
    
    application = Application.builder().token(BOT_TOKEN).build()
    
    # Command handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("sample", sample_command))
    application.add_handler(CommandHandler("status", status_command))
    application.add_handler(CommandHandler("optimize", optimize_command))
    
    # Button callbacks
    application.add_handler(CallbackQueryHandler(button_callback))
    
    # File uploads
    application.add_handler(MessageHandler(filters.Document.ALL, handle_document))
    
    print("[OK] Bot is running! Press Ctrl+C to stop.")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
