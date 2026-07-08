"""PPO training for AO closed-loop control."""

try:
    from stable_baselines3 import PPO
    from ml.rl_control.env import AOClosedLoopEnv

    def train_rl_controller(config: dict, total_timesteps: int = 1_000_000):
        env = AOClosedLoopEnv(config)
        model = PPO(
            policy="MlpPolicy",
            env=env,
            learning_rate=3e-4,
            n_steps=2048,
            batch_size=64,
            n_epochs=10,
            verbose=1,
            tensorboard_log="./logs/rl_control/",
            device="cuda",
        )
        model.learn(
            total_timesteps=total_timesteps,
            callback=None,
        )
        model.save("ml/rl_control/ppo_ao_controller")
        return model

    if __name__ == "__main__":
        import sys, os
        sys.path.insert(0, os.path.abspath("."))
        from pharos.config import load_config
        cfg = load_config("config/system.yaml")
        # Count active subapertures
        from pharos.centroid import build_subaperture_map
        sas = build_subaperture_map(cfg)
        cfg["n_active_subapertures"] = sum(s.active for s in sas)
        train_rl_controller(cfg)

except ImportError as e:
    print(f"RL training requires stable-baselines3 and gymnasium: {e}")
