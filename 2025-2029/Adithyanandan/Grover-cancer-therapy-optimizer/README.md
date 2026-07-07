**Amrita QuantumLeap Bootcamp 2026 — Hackathon**

Grover's algorithm applied to combinatorial cancer therapy selection. Given n candidate drug targets, we search the 2^n possible combinations for ones that maximize therapeutic benefit while staying under a toxicity threshold.
Setup

Python 3.9+ required
bash

pip install -r requirements.txt

Or with a virtual environment:
bash

    python -m venv venv
    source venv/bin/activate        # Windows: venv\Scripts\activate
    pip install -r requirements.txt

Running
bash

jupyter notebook quantum_cancer_grover.ipynb

Run all cells top to bottom. Plots are saved automatically to the working directory:

score_landscape.png
grover_histogram.png
amplitude_amplification.png
classical_vs_quantum.png 
scaling.png
noise_comparison.png
summary_dashboard.png

What it does

Models 6 drug targets (EGFR, KRAS, TP53, VEGF, CDK4, PARP) with benefit/toxicity scores
Builds a Grover oracle marking combinations with net score ≥ threshold
Runs Grover search and measures success probability
Benchmarks against classical random search
Plots amplitude amplification and the over-rotation effect
Simulates depolarizing noise at realistic NISQ error rates
Outputs a summary dashboard of all results

Dependencies

See requirements.txt. Key packages:
Package	Purpose
qiskit	Circuit construction
qiskit-aer	Simulation backend
matplotlib	Plots
numpy	Numerics
pylatexenc	Circuit diagram rendering
References



