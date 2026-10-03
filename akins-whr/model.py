import json
from pathlib import Path

CONFIG_PATH = Path(__file__).with_name("config.json")


def load_config(path=CONFIG_PATH):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def simulate(load_fraction, cfg=None, accessory_fraction_override=None):
    cfg = cfg or load_config()
    eng = cfg["engine"]
    rec = cfg["recovery"]

    load_fraction = clamp(float(load_fraction))
    rated_kw = float(eng["rated_output_kw"])
    useful_engine_kw = rated_kw * load_fraction

    bte = max(float(eng["brake_thermal_efficiency"]), 1e-6)
    fuel_thermal_kw = useful_engine_kw / bte

    exhaust_fraction = clamp(float(eng["exhaust_energy_fraction_of_fuel"]))
    exhaust_heat_kw = fuel_thermal_kw * exhaust_fraction

    hx_eff = clamp(float(rec["heat_exchanger_effectiveness"]))
    captured_heat_kw = exhaust_heat_kw * hx_eff

    exp_eff = clamp(float(rec["expander_thermal_to_shaft_efficiency"]))
    expander_shaft_kw = captured_heat_kw * exp_eff

    alt_eff = clamp(float(rec["alternator_efficiency"]))
    gross_electric_kw = expander_shaft_kw * alt_eff

    fixed_parasitics_kw = float(rec["fixed_parasitics_kw"]) if load_fraction > 0 else 0.0
    variable_parasitics_kw = gross_electric_kw * clamp(
        float(rec["variable_parasitics_fraction_of_gross_electric"])
    )
    parasitics_kw = fixed_parasitics_kw + variable_parasitics_kw

    backpressure_penalty_kw = useful_engine_kw * max(
        0.0, float(rec["backpressure_penalty_fraction_of_engine_output"])
    )

    net_recovered_kw = max(
        0.0, gross_electric_kw - parasitics_kw - backpressure_penalty_kw
    )

    accessory_fraction = (
        float(accessory_fraction_override)
        if accessory_fraction_override is not None
        else float(eng["accessory_load_fraction_of_engine_output"])
    )
    accessory_fraction = max(0.0, accessory_fraction)
    accessory_load_kw = useful_engine_kw * accessory_fraction
    accessory_offset_kw = min(net_recovered_kw, accessory_load_kw)
    surplus_to_dc_bus_kw = max(0.0, net_recovered_kw - accessory_offset_kw)

    # Approximate equal-output fuel-use reduction. This is intentionally simple:
    # net recovered electric power is credited as useful power that the engine
    # would otherwise have to supply. It is bounded to avoid nonsensical output.
    equivalent_fuel_reduction_fraction = 0.0
    if useful_engine_kw > 0:
        equivalent_fuel_reduction_fraction = clamp(net_recovered_kw / useful_engine_kw, 0.0, 0.25)

    module_count = max(1, int(rec["number_of_parallel_exhaust_modules"]))

    return {
        "load_fraction": load_fraction,
        "engine_output_kw": useful_engine_kw,
        "fuel_thermal_input_kw": fuel_thermal_kw,
        "exhaust_heat_kw": exhaust_heat_kw,
        "captured_heat_kw": captured_heat_kw,
        "expander_shaft_kw": expander_shaft_kw,
        "gross_electric_kw": gross_electric_kw,
        "parasitics_kw": parasitics_kw,
        "backpressure_penalty_kw": backpressure_penalty_kw,
        "net_recovered_kw": net_recovered_kw,
        "gross_per_module_kw": gross_electric_kw / module_count,
        "net_per_module_kw": net_recovered_kw / module_count,
        "accessory_load_kw": accessory_load_kw,
        "accessory_offset_kw": accessory_offset_kw,
        "surplus_to_dc_bus_kw": surplus_to_dc_bus_kw,
        "equivalent_fuel_reduction_percent": equivalent_fuel_reduction_fraction * 100.0,
    }


def run_operating_map(cfg=None):
    cfg = cfg or load_config()
    return {
        name: simulate(load, cfg)
        for name, load in cfg["operating_points"].items()
    }


def format_row(name, result):
    return (
        f"{name:10s} | load {result['load_fraction']*100:5.1f}% | "
        f"engine {result['engine_output_kw']:6.2f} kW | "
        f"exhaust {result['exhaust_heat_kw']:6.2f} kWth | "
        f"net WHR {result['net_recovered_kw']:5.2f} kWe | "
        f"fuel equiv {result['equivalent_fuel_reduction_percent']:4.1f}%"
    )


if __name__ == "__main__":
    config = load_config()
    results = run_operating_map(config)
    print("AKINS A0 Twin Exhaust Waste-Heat Recovery Estimate")
    print("-" * 86)
    for mode, values in results.items():
        print(format_row(mode, values))

    print("\n30% accessory-load stress case at 25% engine load")
    stress = simulate(0.25, config, accessory_fraction_override=0.30)
    for key in (
        "engine_output_kw",
        "accessory_load_kw",
        "net_recovered_kw",
        "accessory_offset_kw",
        "surplus_to_dc_bus_kw",
    ):
        print(f"{key}: {stress[key]:.3f}")
