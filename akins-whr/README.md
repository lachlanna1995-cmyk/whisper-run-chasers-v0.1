# AKINS A0 Twin Waste-Heat Turbo-Alternator Model

This isolated engineering model explores exhaust waste-heat recovery for the AKINS A0 opposed-piston alcohol-fueled range-extender concept.

## Baseline concept
- 250 cc total displacement
- two opposed-piston combustion cells / two exhaust streams
- target engine output: ~22.4 kW (30 hp)
- alcohol direct injection
- integrated permanent-magnet main generator on a ~400 VDC bus
- beltless electric accessories
- twin wrapped exhaust heat exchangers
- two turbocharger-style radial-inflow micro expanders
- direct-coupled high-speed permanent-magnet alternators
- shared condenser, feed pump and reservoir

## What the model calculates
The model is deliberately assumption-driven because the AKINS engine has not yet produced measured exhaust mass-flow, temperature, BSFC or pressure-drop data.

For each operating point it estimates:
1. fuel thermal input
2. exhaust thermal power
3. recoverable heat through the two wrapped exchangers
4. expander shaft power
5. alternator electrical output
6. pump/condenser/control parasitics
7. exhaust-backpressure penalty
8. accessory-load offset
9. net power delivered to the 400 V bus
10. equivalent fuel-use reduction at equal useful output

## Default engineering philosophy
Defaults are conservative starting points, not performance claims. Small-engine WHR is difficult at light load because exhaust temperature and mass flow fall rapidly. Water/steam is expected to have a narrower operating window than a lower-boiling ORC-style fluid.

Published work supports the architecture but not these exact AKINS numbers. SAE studies on ~25-27 kW diesel engines report meaningful Rankine-cycle recovery at design load while also showing that water may stop producing useful power at low load. Other ORC/turbo-generator studies emphasize optimizing heat exchanger pressure drop because excessive backpressure can erase the recovered benefit.

## Safety / design requirements
- independent exhaust and working-fluid circuits
- exhaust bypass around each heat exchanger
- working-fluid bypass around each expander
- redundant overspeed detection
- electrical dump load for sudden DC-bus disconnect
- pressure relief and over-temperature cutout
- turbine containment housing
- alternator thermally isolated from turbine housing
- no claim that captured soot/CO2 disappears; any capture media or condensate becomes a service/disposal stream

## First validation measurements needed from a physical AKINS prototype
- exhaust temperature per port vs rpm/load
- exhaust mass flow per port
- exhaust pressure upstream/downstream of proposed exchanger
- fuel mass flow and lower heating value
- brake/generator output vs rpm/load
- coolant rejection
- accessory electrical demand

Those measurements replace assumptions in `config.json` and turn the model from a concept estimator into a calibration model.
