import unittest

from model import load_config, simulate


class AkinsWHRModelTests(unittest.TestCase):
    def setUp(self):
        self.cfg = load_config()

    def test_zero_load_produces_zero_recovery(self):
        r = simulate(0.0, self.cfg)
        self.assertEqual(r["engine_output_kw"], 0.0)
        self.assertEqual(r["net_recovered_kw"], 0.0)

    def test_recovery_increases_with_load(self):
        low = simulate(0.25, self.cfg)
        high = simulate(1.0, self.cfg)
        self.assertGreater(high["net_recovered_kw"], low["net_recovered_kw"])

    def test_net_is_below_gross(self):
        r = simulate(1.0, self.cfg)
        self.assertLessEqual(r["net_recovered_kw"], r["gross_electric_kw"])

    def test_twin_modules_split_total_output(self):
        r = simulate(1.0, self.cfg)
        self.assertAlmostEqual(r["gross_per_module_kw"] * 2, r["gross_electric_kw"], places=8)

    def test_30_percent_accessory_case_is_supported(self):
        r = simulate(0.25, self.cfg, accessory_fraction_override=0.30)
        self.assertAlmostEqual(r["accessory_load_kw"], r["engine_output_kw"] * 0.30, places=8)
        self.assertLessEqual(r["accessory_offset_kw"], r["accessory_load_kw"])


if __name__ == "__main__":
    unittest.main()
