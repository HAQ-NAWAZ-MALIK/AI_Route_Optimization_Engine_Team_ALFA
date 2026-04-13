# AI Route Optimizer - Telegram Bot

A Telegram bot for testing the AI Transport Optimizer API.

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the bot
python bot.py
```

## Features

- 📊 **Sample Data**: Pre-loaded with 10 employees and 3 cabs
- 📤 **CSV Upload**: Upload your own data files
- 🚀 **Optimize**: Call multi-cluster optimization API
- 📋 **Results**: Beautiful formatted route results

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Start the bot |
| `/sample` | Run with sample data |
| `/status` | Check API health |
| `/optimize` | Optimize uploaded data |
| `/help` | Show help |

## CSV Format

**employees.csv:**
```csv
id,name,lat,lng
emp1,Alice,34.0625,-118.3050
emp2,Bob,34.0755,-118.2890
```

**cabs.csv:**
```csv
id,name,capacity
cab1,Cab A,4
cab2,Cab B,4
```

## Requirements

- Python 3.8+
- AI Transport Optimizer API running on `localhost:3001`
