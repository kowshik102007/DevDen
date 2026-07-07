from timeit import main
import tkinter as tk
import time
import random
import csv
from datetime import datetime
from tkinter import messagebox
from turtle import right
import matplotlib.pyplot as plt
from numpy._core.numeric import inner
import matplotlib



class BellmanCartoonGame(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Bellman Equation  – Gridworld Value Iteration")
        self.geometry("1480x940")
        self.configure(bg="white")
        self.delta_history = []
        self.speed = tk.DoubleVar(value=0.3)
        self.Q = [[[0]*4 for _ in range(4)] for _ in range(4)]
        self.alpha = 0.1
        self.epsilon = 0.2
        

        # ====================== EVALUATION LOGGING ======================
        self.start_time = time.time()
        self.bellman_steps = 0
        self.run8_count = 0
        self.move_agent_count = 0
        self.mcq_attempts = 0
        self.mcq_correct = 0
        self.log_data = []
        self.quiz_history = []

        # ====================== CORE VARIABLES ======================
        self.gamma = 0.9
        self.grid_size = 4

        self.goal = (0, 3)
        self.traps = [(1, 2), (2, 1), (2, 3), (3, 2)]
        self.start = (3, 0)

        self.V = [[0.0] * self.grid_size for _ in range(self.grid_size)]
        self.V_before = None
        self.V_after = None
        self.V_prev_step = None
        self.V_latest_step = None
        self.last_updated_cell = None
        self.policy = [["?"] * self.grid_size for _ in range(self.grid_size)]
        self.current_pos = self.start

        # Progress tracking
        self.iteration = 0
        self.last_delta = 0.0
        self.max_delta_this_run = 0.0

        # Quiz & score
        # ================= QUIZ SYSTEM =================

        self.score_correct = 0
        self.score_total = 0
        self.current_mcq = None
        self.easy_mcqs, self.medium_mcqs, self.hard_mcqs = self._prepare_mcqs()
        self.pretest_questions = [

{
    "q": "If γ is increased from 0.5 to 0.99, what happens to how much the agent values distant future rewards?",
    "options": [
        "A) The agent completely ignores rewards that are close by",    
"B) Immediate rewards become less important than future rewards",
" C) Distant future rewards contribute more strongly to state values",
"D) The values of all states become identical"
    ],
    "answer": " C) Distant future rewards contribute more strongly to state values"
},

{
"q":"What does the policy arrow shown in a cell represent?",
"options":[
"A) The action that currently gives the highest estimated value from that state",
"B) The action that leads to the neighbour with the highest immediate reward",
"C) The action that was used most recently to update that state",
"D) The action that moves the agent along the shortest path to the goal"
],
"answer":"A) The action that currently gives the highest estimated value from that state"
},

{
    "q":" In Value Iteration, what does it indicate when the change in state values (Δ) becomes smaller and approaches zero over successive updates?",
    "options": [
        
        "A) The grid is being reset",
        "B) The agent has physically reached the goal",
        "C) The rewards are increasing over time",
        "D) The value function is settling into a stable solution"
    ],
    "answer": "D) The value function is settling into a stable solution"
},

{
"q":"Why do values farther from the goal end up smaller than values near the goal?",
"options":[
"A) The goal reward is discounted repeatedly as it propagates through more states",
"B) States near the goal are updated earlier and therefore keep larger values",
"C) The Bellman equation gives greater weight to nearby states than distant states",
"D) States farther from the goal receive fewer Bellman updates"
],
"answer":"A) The goal reward is discounted repeatedly as it propagates through more states"
},

{
"q":"A trap cell with a large negative reward sits next to the goal. What effect does this have on the cells around the trap?",
"options":[
           "A) Their values rise, since traps add bonus reward nearby",
           "B) Nothing changes, traps only affect their own value",
           "C) Their values drop, since the optimal action must avoid stepping into the trap",
           "D) The grid stops updating entirely"],
"answer":"C) Their values drop, since the optimal action must avoid stepping into the trap"
},
{
    "q": "Suppose the step penalty (-0.1) is replaced by a step bonus (+0.1). Would the agent still find the goal?",
    "options": [
        "A) Yes — the goal reward always dominates",
        "B) No — the agent may prefer wandering forever to collect bonus rewards"
    ],
    "answer": "B) No — the agent may prefer wandering forever to collect bonus rewards"
},

{
    "q":"Suppose Value Iteration updates states in a random order rather than a fixed sweep order. Will it still converge to the same final value function?" ,
    "options": [
        "A) Yes — update order doesn't change the final converged values, only how fast you reach them",
        "B) No — picking cells in a different order produces a different final value function"
    ],
    "answer": "A) Yes — update order doesn't change the final converged values, only how fast you reach them"
}
]

        
        self.pretest_score = 0
        self.show_pretest()
        
    def show_pretest(self):
        

        canvas = tk.Canvas(self, bg="white")
        scrollbar = tk.Scrollbar(self, orient="vertical", command=canvas.yview)

        canvas.configure(yscrollcommand=scrollbar.set)

        scrollbar.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)

        self.pretest_frame = tk.Frame(canvas, bg="white")

        canvas.create_window((0,0), window=self.pretest_frame, anchor="nw")
        tk.Label(self.pretest_frame,text="Pre-Test Quiz",font=("Arial",20,"bold")).pack(pady=20)

   
        def on_frame_configure(event):
            canvas.configure(scrollregion=canvas.bbox("all"))

        self.pretest_frame.bind("<Configure>", on_frame_configure)
        def on_mousewheel(event):
            canvas.yview_scroll(int(-1*(event.delta/120)), "units")

        canvas.bind_all("<MouseWheel>", on_mousewheel)
        self.pretest_canvas = canvas

        self.pretest_vars = []

        for q in self.pretest_questions:

            frame = tk.Frame(self.pretest_frame, bg="white")
            frame.pack(anchor="w", padx=40, pady=10)

            tk.Label(frame,text=q["q"],font=("Arial", 13, "bold"),bg="white").pack(anchor="w")

            var = tk.StringVar()

            self.pretest_vars.append(var)

            for opt in q["options"]:
                tk.Radiobutton( frame,text=opt,variable=var,value=opt,bg="white",font=("Arial", 11)).pack(anchor="w")

        tk.Button(self.pretest_frame,text="Submit Pre-Test",font=("Arial",14,"bold"),bg="#28a745",fg="white",command=self.submit_pretest).pack(pady=20)
        tk.Button(self.pretest_frame,text="Start Simulation",font=("Arial",14,"bold"),bg="#0D6EFD",fg="white",width=20,command=self.finish_pretest).pack(pady=20)
    
    
    
    def submit_pretest(self):

        score = 0

        for i, q in enumerate(self.pretest_questions):

            if self.pretest_vars[i].get() == q["answer"]:
                score += 1

        self.pretest_score = score  # save it so we can compare against the post-test later

        messagebox.showinfo(
            "Pre-Test Result",
            f"Your Score: {score}/{len(self.pretest_questions)}")
        self.finish_pretest()
    def finish_pretest(self):
        self.pretest_canvas.unbind_all("<MouseWheel>")
        for widget in self.winfo_children():
            widget.destroy()
        self.create_ui()
        self.reset_game()
    def on_mousewheel(event):
        try:
            canvas.yview_scroll(int(-1*(event.delta/120)), "units")
        except tk.TclError:
            pass
    def _prepare_mcqs(self):

    # ================= EASY =================



        easy_mcqs = [

            {
            "q":"Why is a state's value updated during value iteration?",
            "options":["A) It uses information from neighbouring states",
           "B) The goal moves",
           "C) The grid size changes",
           "D) Rewards are removed"],
        "answer":"A"
            },

            {
            "q":"What does the discount factor γ represent?",
            "options":["A) Grid size",
           "B) Number of states",
           "C) Importance of future rewards",
           "D) Agent speed"],
        "answer":"C"
},

{
"q":"Why are trap states given negative rewards?",
"options":["A)To increase score ",
           "B) To encourage the agent to avoid them",
           "C) To remove the state",
           "D) To speed up updates"],
"answer":"B"
},
            {
"q":"What is being measured when the app tracks 'delta' after each update?",
"options":["A) The agent's movement speed",
           "B) The number of trap cells",
           "C) The change in a cell's value before vs. after the update",
           "D) The size of the grid"],
"answer":"C"
}

]


        
    # ================= MEDIUM =================
        medium_mcqs = [

        {
        "q":"Why doesn't value iteration reach the final solution in a single sweep?",
    "options":["A) Values need time to propagate through the grid",
           "B) The Bellman equation only updates one state",
           "C) Rewards are generated randomly",
           "D) The goal changes position"],
        "answer":"A"
        },
        {
        "q":"Why are repeated Bellman sweeps performed?",
        "options":["A) To randomize actions",
           "B) To reset values",
           "C) To allow values to converge gradually",
           "D) To generate rewards"],
        "answer":"C"
        },

        {
        "q":"Why do cells near the goal usually gain higher values first?",
        "options":["A) Distant cells cannot be updated",
           "B) Goal information propagates outward over sweeps",
           "C) The Bellman equation ignores distant cells",
           "D) The goal updates them directly"],
    "answer":"B"
        },

        
        {
"q":"If you watch the Convergence Graph and delta keeps shrinking toward zero across more steps, what does this tell you?",
"options":["A) More grid cells are being added",
           "B) The traps are being removed from the grid",
           "C) The goal has moved to a new location",
           "D) The value function is approaching a stable solution"],
"answer":"D"
}

        ]
        

    
        
        
    # ================= HARD =================

        hard_mcqs = [

{
"q":"Cell A updates using B's old value. Later B's value increases. What happens?",
"options":["A) A keeps its value permanently, since it already used B once",
           "B) A's value increases immediately, since B is already in memory",
           "C) A waits until the next sweep to benefit",
           "D) A and B's values are averaged automatically"],
"answer":"C"
},

{
"q":"If the goal reward is increased, what is likely to happen?",
"options":["A) States far from the goal increase more than states near it",
           "B) Only the goal cell's value changes; neighboring cells stay the same",
           "C) Every state's value increases by the same amount, regardless of distance",
           "D) States near the goal will gain higher values"],
"answer":"D"
},

{
"q":"What may happen if every step gives a positive reward instead of a penalty?",
"options":["A) The agent may wander forever, since delaying the goal also earns reward",
           "B) The agent reaches the goal in fewer steps than before",
           "C) The optimal policy stays exactly the same as with a step penalty",
           "D) The agent is forced to take the shortest path regardless of reward"],
"answer":"A"
},

]
        return easy_mcqs, medium_mcqs, hard_mcqs
    def create_ui(self):
    # Title
        tk.Label(self, text="Bellman Equation – Gridworld Value Iteration",
             font=("Segoe UI", 22, "bold"), bg="white", fg="#0066cc").pack(pady=10)

        

        btn_frame = tk.Frame(self, bg="white")
        btn_frame.pack(pady=10)

        tk.Button(btn_frame, text="🔲 Next Bellman Step", font=("Arial", 13, "bold"),
              bg="#28a745", fg="white", width=18,
              command=self.one_bellman_step).pack(side="left", padx=8)

        tk.Button(btn_frame, text="▶ Run 8 Steps", font=("Arial", 13, "bold"),
              bg="#ffc107", fg="black", width=16,
              command=self.run_multiple).pack(side="left", padx=8)

        tk.Button(btn_frame, text="➤ Move Agent (Greedy)", font=("Arial", 13, "bold"),
              bg="#17a2b8", fg="white", width=20,
              command=self.move_agent).pack(side="left", padx=8)
        
        more_btn = tk.Menubutton(btn_frame,text="☰ More",font=("Arial", 13, "bold"),bg="#6f42c1",
            fg="white",relief="raised")
        more_btn.pack(side="left", padx=8)
        more_menu = tk.Menu(more_btn, tearoff=0)
        more_menu.add_command(label="Reset", command=self.reset_game)
        more_menu.add_command(label="Show Graph",command=self.show_graph)
        more_menu.add_command(label="Show Path",command=self.highlight_path)
        more_menu.add_command(label="Show Latest Update", command=self.show_latest_update_comparison)
        more_menu.add_separator()
        more_menu.add_command(label="Survey",command=self.finish_and_export)
        more_btn.config(menu=more_menu)
        main = tk.Frame(self, bg="white")
        main.pack(pady=10, padx=20, fill="both", expand=True)

        # ── LEFT ── Value Grid
        left = tk.Frame(main, bg="white")
        left.pack(side="left", padx=(0, 20))

        tk.Label(left, text="State Values", font=("Arial", 14, "bold"), bg="white", fg="#0066cc").pack(pady=(0,6))

        grid_frame = tk.Frame(left, bg="white")
        grid_frame.pack()
        self.cells = [[None]*4 for _ in range(4)]
        self.agent_labels = [[None]*4 for _ in range(4)]

        for r in range(4):
            for c in range(4):
                cell = tk.Frame(grid_frame, width=130, height=130, bg="white", relief="ridge", bd=2)
                cell.grid(row=r, column=c, padx=5, pady=5)
                cell.pack_propagate(False)

                lbl = tk.Label(cell, text="0.00", font=("Consolas", 15, "bold"), bg="white", fg="#333")
                lbl.pack(expand=True)
                self.cells[r][c] = lbl

                agent = tk.Label(cell, text="A", font=("Arial", 42, "bold"), bg="white", fg="#ff9900")
                agent.place(relx=0.5, rely=0.5, anchor="center")
                agent.lower()
                self.agent_labels[r][c] = agent

        # ── MIDDLE ── Policy + Stats
        middle = tk.Frame(main, bg="white")
        middle.pack(side="left", padx=40)

        tk.Label(middle, text="Current Greedy Policy", font=("Arial", 14, "bold"), bg="white", fg="#0066cc").pack(pady=(0,6))

        policy_frame = tk.Frame(middle, bg="white")
        policy_frame.pack()
        self.policy_arrows = [[None]*4 for _ in range(4)]
        for r in range(4):
            for c in range(4):
                cell = tk.Frame(policy_frame, width=100, height=100, bg="white", relief="ridge", bd=2)
                cell.grid(row=r, column=c, padx=4, pady=4)
                cell.pack_propagate(False)
                arrow = tk.Label(cell, text="?", font=("Arial", 40, "bold"), bg="white", fg="#17a2b8")
                arrow.pack(expand=True)
                self.policy_arrows[r][c] = arrow

        # Stats
        eqf = tk.LabelFrame(middle, text="Bellman Optimality Equation", font=("Arial", 13, "bold"),
                            bg="white", fg="#0066cc")
        
        eqf.pack(fill="both",expand=True, padx=8, pady=(0,10))
        tk.Label(eqf, text="V(s) ← max_a [ R(s,a) + γ × V(s') ]",
            font=("Consolas", 12, "bold"), bg="white", fg="#cc6600",
            justify="left").pack(pady=8, anchor="w", padx=5)

        tk.Label(eqf, text="Core recurrence of Dynamic Programming (value iteration)",
        font=("Arial", 9, "italic"), bg="white", fg="#555",
        wraplength=420, justify="left").pack(anchor="w", padx=5)

        tk.Button(eqf, text="▶ Compare γ Effect (Low vs High)", font=("Arial", 10, "bold"),
           bg="#6f42c1", fg="white", command=self.show_gamma_comparison).pack(pady=(8,10), padx=5, fill="x")

        # ── RIGHT ── Controls & Info
        # — RIGHT — Controls & Info (Scrollable)
        right_outer = tk.Frame(main, bg="white", width=450)
        right_outer.pack(side="right", fill="both", padx=(20,0))

        canvas = tk.Canvas(right_outer, bg="white", highlightthickness=0)
        canvas.pack(side="left", fill="both", expand=True)

        right = tk.Frame(canvas, bg="white")

        canvas_window = canvas.create_window((0, 0),window=right,anchor="nw")

        
        def on_frame_configure(event):
            canvas.configure(scrollregion=canvas.bbox("all"))
        right.bind("<Configure>", on_frame_configure)

# Add this 👇 to fix width cutting off
        def on_canvas_configure(event):
            canvas.itemconfig(canvas_window, width=event.width)
        canvas.bind("<Configure>", on_canvas_configure)

       
        # Latest update
        self.calc_frame = tk.LabelFrame(right, text="Latest Cell Update", font=("Arial", 13, "bold"),
                                        bg="white", fg="#cc6600")
        self.calc_frame.pack(fill="x", padx=12, pady=(90,10))

        self.calc_label = tk.Label(self.calc_frame, text="Press 'Next Bellman Step' to begin",
                                   font=("Consolas", 11), bg="white", fg="#333", justify="left",wraplength=240,width=35,anchor="w")
        self.calc_label.pack(fill="x", padx=15, pady=10)

        # Quiz
        self.quiz_frame = tk.LabelFrame(right, text="Bellman Quiz", font=("Arial", 13, "bold"),
                                        bg="white", fg="#6f42c1")
        self.quiz_frame.pack(fill="both",expand=True, padx=12, pady=10)

        self.quiz_q = tk.Label(self.quiz_frame, text="(question appears after update)",
                               font=("Consolas", 10), bg="white", fg="#2c3e50", justify="left", wraplength=260)
        self.quiz_q.pack(pady=6, padx=10, anchor="w")

        ans_btns = tk.Frame(self.quiz_frame, bg="white")
        ans_btns.pack(pady=6)
        for ch in "ABCD":
            tk.Button(ans_btns, text=ch, font=("Arial", 11, "bold"), width=3,
                      bg="#e9ecef", fg="#343a40",
                      command=lambda x=ch: self.on_answer(x)).pack(side="left", padx=8)

        self.quiz_feedback = tk.Label(self.quiz_frame, text="", font=("Consolas", 10, "italic"),
                                      bg="white", fg="#28a745", wraplength=260)
        self.quiz_feedback.pack(pady=6, padx=10, anchor="w")

        self.score_label = tk.Label(right, text="Score: 0 / 0   ", font=("Arial", 11, "bold"),
                                    bg="white", fg="#495057")
        self.score_label.pack(pady=4, anchor="e")

        # Before / After move
        

        # Main buttons
    
    def show_graph(self):
        plt.plot(self.delta_history)
        plt.title("Convergence Graph (Δ vs Iterations)")
        plt.xlabel("Iteration")
        plt.ylabel("Delta")
        plt.grid()
        plt.show()

    def reset_game(self):
        for r in range(4):
            for c in range(4):
                self.V[r][c] = 0.0
                self.policy[r][c] = "?"
                self.cells[r][c].config(text="0.00", fg="#333", bg="white")
                self.agent_labels[r][c].lower()
                self.policy_arrows[r][c].config(text="?", fg="#aaa")

        self.current_pos = self.start
        self.agent_labels[self.start[0]][self.start[1]].lift()
        self.agent_labels[self.start[0]][self.start[1]].config(text="A", fg="#ff9900")

        self.highlight_special()
        self.update_all_cells()
        self.update_policy_arrows()

        
        self.calc_label.config(text="Press 'Next Bellman Step' to update one cell Watch values propagate backwards")
        self.quiz_q.config(text="(question appears after next update)")
        self.quiz_feedback.config(text="")
        self.score_correct = 0
        self.score_total = 0
        self.score_label.config(text="Score: 0 / 0")
        self.current_mcq = None

        self.iteration = 0
        self.last_delta = 0.0
        self.max_delta_this_run = 0.0
        self.V_before = [row[:] for row in self.V]

    def highlight_special(self):
        self.cells[self.goal[0]][self.goal[1]].config(text="G", font=("Arial", 32, "bold"),
                                                      fg="#ffcc00", bg="#fff3cd")
        for tr, tc in self.traps:
            self.cells[tr][tc].config(text="X", font=("Arial", 32, "bold"),
                                      fg="#dc3545", bg="#f8d7da")
    def highlight_path(self):
        r, c = self.start
        visited = set()

        while (r, c) != self.goal and (r, c) not in visited:
            visited.add((r, c))
            self.cells[r][c].config(bg="#90ee90")  # light green

            action = self.policy[r][c]
            moves = {"↑":(-1,0), "↓":(1,0), "←":(0,-1), "→":(0,1)}

            if action not in moves:
                break

            dr, dc = moves[action]
            r, c = r + dr, c + dc

    def _build_value_grid(self, parent, values, highlight=None):
        grid = tk.Frame(parent, bg="white")
        grid.pack()
        for r in range(4):
            for c in range(4):
                if (r, c) == self.goal:
                    text, bg, fg = "G", "#fff3cd", "#ffcc00"
                elif (r, c) in self.traps:
                    text, bg, fg = "X", "#f8d7da", "#dc3545"
                else:
                    v = values[r][c]
                    text = f"{v:+.2f}"
                    bg = "white"
                    fg = "#28a745" if v > 0.4 else "#dc3545" if v < -0.4 else "#444"
                is_hl = (highlight == (r, c))
                cell = tk.Frame(grid, width=70, height=70, bg=bg, relief="ridge", bd=1,
                             highlightthickness=3 if is_hl else 0,
                             highlightbackground="#ffc107")
                cell.grid(row=r, column=c, padx=2, pady=2)
                cell.pack_propagate(False)
                tk.Label(cell, text=text, font=("Consolas", 11, "bold"), bg=bg, fg=fg).pack(expand=True)
    def _simulate_value_iteration(self, gamma, sweeps=15):
        V = [[0.0]*4 for _ in range(4)]
        directions = [(-1,0),(1,0),(0,-1),(0,1)]
        for _ in range(sweeps):
            new_V = [row[:] for row in V]
            for r in range(4):
                for c in range(4):
                    if (r,c) == self.goal or (r,c) in self.traps:
                        continue
                    best = float('-inf')
                    for dr, dc in directions:
                        nr, nc = r+dr, c+dc
                        if 0 <= nr < 4 and 0 <= nc < 4:
                            reward = 10 if (nr,nc)==self.goal else -5 if (nr,nc) in self.traps else -0.1
                            val = reward + gamma * V[nr][nc]
                            if val > best:
                                best = val
                    new_V[r][c] = best
            V = new_V
        return V

    def show_gamma_comparison(self):
        low_gamma, high_gamma, sweeps = 0.1, 0.95, 15

        V_low = self._simulate_value_iteration(low_gamma, sweeps)
        V_high = self._simulate_value_iteration(high_gamma, sweeps)

        win = tk.Toplevel(self)
        win.title("Effect of γ — Low vs High Discount Factor")
        win.geometry("700x460")
        win.configure(bg="white")

        tk.Label(win, text="How γ Changes What The Agent Values",
             font=("Arial", 16, "bold"), bg="white", fg="#0066cc").pack(pady=10)
        tk.Label(win, text=f"Both grids ran {sweeps} full sweeps of value iteration, starting from V=0 — the only difference is γ.",
             font=("Arial", 10, "italic"), bg="white", fg="#555").pack(pady=(0,10))

        grids_frame = tk.Frame(win, bg="white")
        grids_frame.pack(pady=10)

        low_frame = tk.Frame(grids_frame, bg="white")
        low_frame.pack(side="left", padx=20)
        tk.Label(low_frame, text=f"LOW γ = {low_gamma}",
             font=("Arial", 12, "bold"), bg="white", fg="#dc3545").pack(pady=(0,8))
        self._build_value_grid(low_frame, V_low)

        high_frame = tk.Frame(grids_frame, bg="white")
        high_frame.pack(side="left", padx=20)
        tk.Label(high_frame, text=f"HIGH γ = {high_gamma}",
             font=("Arial", 12, "bold"), bg="white", fg="#28a745").pack(pady=(0,8))
        self._build_value_grid(high_frame, V_high)

        tk.Label(win, text="Notice how the low-γ grid only carries meaningful value near the goal,\nwhile the high-γ grid spreads value much farther across the map.",
             font=("Consolas", 10), bg="white", fg="#cc6600", justify="center").pack(pady=15)

        tk.Button(win, text="Close", font=("Arial", 12, "bold"),
              bg="#0D6EFD", fg="white", command=win.destroy).pack(pady=5)
    def update_all_cells(self):
        for r in range(4):
            for c in range(4):
                if (r,c) == self.goal or (r,c) in self.traps:
                    continue
                v = self.V[r][c]
                color = "#28a745" if v > 0.4 else "#dc3545" if v < -0.4 else "#444"
                self.cells[r][c].config(text=f"{v:+.2f}", fg=color)


    def show_latest_update_comparison(self):
        if self.V_prev_step is None or self.V_latest_step is None:
            messagebox.showinfo("No Updates Yet", "Run at least one Bellman step first.")
            return

        win = tk.Toplevel(self)
        win.title("Latest Update vs Previous Step")
        win.geometry("700x420")
        win.configure(bg="white")

        tk.Label(win, text="What Changed In The Last Update",
             font=("Arial", 16, "bold"), bg="white", fg="#0066cc").pack(pady=10)

        grids_frame = tk.Frame(win, bg="white")
        grids_frame.pack(pady=10)

        before_frame = tk.Frame(grids_frame, bg="white")
        before_frame.pack(side="left", padx=20)
        tk.Label(before_frame, text="STEP BEFORE (previous)",
             font=("Arial", 12, "bold"), bg="white", fg="#6c757d").pack(pady=(0,8))
        self._build_value_grid(before_frame, self.V_prev_step)

        after_frame = tk.Frame(grids_frame, bg="white")
        after_frame.pack(side="left", padx=20)
        tk.Label(after_frame, text="LATEST UPDATE (now)",
             font=("Arial", 12, "bold"), bg="white", fg="#28a745").pack(pady=(0,8))
        self._build_value_grid(after_frame, self.V_latest_step, highlight=self.last_updated_cell)

        r, c = self.last_updated_cell
        change = self.V_latest_step[r][c] - self.V_prev_step[r][c]
        tk.Label(win, text=f"Only cell ({r},{c}) changed this step: {change:+.2f}",
             font=("Consolas", 12, "bold"), bg="white", fg="#cc6600").pack(pady=15)

        tk.Button(win, text="Close", font=("Arial", 12, "bold"),
              bg="#0D6EFD", fg="white", command=win.destroy).pack(pady=5)
    def update_policy_arrows(self):
        arrows_map = {"↑":"↑", "↓":"↓", "←":"←", "→":"→", "?":"?"}
        for r in range(4):
            for c in range(4):
                if (r,c) == self.goal:
                    self.policy_arrows[r][c].config(text="G", fg="#ffcc00", font=("Arial", 28, "bold"))
                elif (r,c) in self.traps:
                    self.policy_arrows[r][c].config(text="X", fg="#dc3545", font=("Arial", 28, "bold"))
                else:
                    a = self.policy[r][c]
                    txt = arrows_map.get(a, "?")
                    self.policy_arrows[r][c].config(text=txt, fg="#17a2b8" if a != "?" else "#aaa")

    
    def log_event(self, event_type, details=""):
        timestamp = time.time() - self.start_time
        self.log_data.append({
            "timestamp_sec": round(timestamp, 2),
            "event": event_type,
            "details": details,
            "bellman_steps": self.bellman_steps,
            "mcq_correct": self.mcq_correct,
            "mcq_total": self.mcq_attempts
        })

    def one_bellman_step(self):
        candidates = [(r,c) for r in range(4) for c in range(4)
                      if (r,c) != self.goal and (r,c) not in self.traps]
        if not candidates:
            return

        r, c = random.choice(candidates)
        self.V_prev_step = [row[:] for row in self.V]

        self.cells[r][c].config(bg="#d1e7ff", relief="raised", bd=4)
        self.update()
        time.sleep(0.3)

        old_v = self.V[r][c]
        best_v = float('-inf')
        best_action = "?"

        directions = [("↑", -1, 0), ("↓", 1, 0), ("←", 0, -1), ("→", 0, 1)]

        backups = []
        for a, dr, dc in directions:
            nr, nc = r + dr, c + dc
            if 0 <= nr < 4 and 0 <= nc < 4:
                reward = 10 if (nr,nc) == self.goal else -5 if (nr,nc) in self.traps else -0.1
                val = reward + self.gamma * self.V[nr][nc]
                backups.append(f"{a} → {reward:+.1f} + {self.gamma:.1f}×{self.V[nr][nc]:+.2f} = {val:+.2f}")
                if val > best_v:
                    best_v = val
                    best_action = a

        delta = abs(best_v - old_v)
        self.last_delta = delta
        self.max_delta_this_run = max(self.max_delta_this_run, delta)
        self.iteration += 1
        self.bellman_steps += 1

        self.V[r][c] = best_v
        self.policy[r][c] = best_action
        self.V_latest_step = [row[:] for row in self.V]
        self.last_updated_cell = (r, c)

        calc_text = f"Updating cell ({r},{c})\nOld V = {old_v:+.2f}\n\n" + \
                    "\n".join(backups) + f"\n\n→ Best = {best_v:+.2f}    Action = {best_action}"
        self.calc_label.config(text=calc_text)

        self.after(800, lambda: self.cells[r][c].config(bg="white", relief="ridge", bd=2))
        self.update_all_cells()
        self.update_policy_arrows()
        self.log_event("Bellman_Step", f"Updated cell ({r},{c}) with action {best_action}")
        delta = abs(best_v - old_v)
        self.last_delta = delta
        self.max_delta_this_run = max(self.max_delta_this_run, delta)
        self.iteration += 1

        self.delta_history.append(delta)
        # Quiz
        # ================= SELECT QUIZ DIFFICULTY =================
        if self.current_mcq is None:
            if self.mcq_correct < 4:
                question_pool = self.easy_mcqs
            elif self.mcq_correct < 8:
                question_pool = self.medium_mcqs
            else:
                question_pool = self.hard_mcqs
            print("Pool size =", len(question_pool))
            if not question_pool:
                print("No questions available!")
                return
            self.current_mcq = random.choice(question_pool)
            question_pool.remove(self.current_mcq)
            options_text = "\n".join(self.current_mcq["options"])
            qtext = self.current_mcq["q"].format(
            r=r,
            c=c,
            action=best_action)+ "\n\n" + options_text
            self.quiz_q.config(text=qtext)
            self.quiz_feedback.config(text="Choose A / B / C / D",fg="#6f42c1")
    def on_answer(self, choice):

        if not self.current_mcq:
            return

    # total attempts
        self.score_total += 1
        self.mcq_attempts += 1

        correct = self.current_mcq["answer"]
        explain = self.current_mcq.get("explain", "")

        is_correct = choice.upper() == correct
        if is_correct:
            self.quiz_history.append(1)
        else:
            self.quiz_history.append(0)

        if is_correct:

            self.score_correct += 1
            self.mcq_correct += 1

            msg = f"✅ Correct! {explain}"
            color = "#28a745"
            self.current_mcq = None

        else:

        # keep SAME question
            msg = "❌ Wrong answer. Try again!"
            color = "#dc3545"

        self.quiz_feedback.config(text=msg, fg=color)

    # FIXED SCORE
        self.score_label.config(
        text=f"Score: {self.score_correct} / {self.score_total}")

        self.log_event(
        "MCQ_Answer",
        f"Answered {choice} | Correct: {is_correct}"
    )

    def run_multiple(self):
        self.run8_count += 1
        self.log_event("Run_8_Steps", "Executed batch of 8 steps")
        for _ in range(8):
            self.one_bellman_step()
            self.update()
            time.sleep(self.speed.get())

    def move_agent(self):
        r, c = self.current_pos
        action = self.policy[r][c]
        if action == "?":
            self.calc_label.config(text="Run more Bellman steps first — policy not ready yet.")
            return

        self.move_agent_count += 1
        self.log_event("Move_Agent", f"Moved using action {action}")

        drs = {"↑":(-1,0), "↓":(1,0), "←":(0,-1), "→":(0,1)}
        dr, dc = drs[action]
        nr, nc = r + dr, c + dc

        

        self.agent_labels[r][c].lower()
        self.agent_labels[nr][nc].lift()
        self.agent_labels[nr][nc].config(text="A", fg="#ff9900")
        self.current_pos = (nr, nc)
    def finish_and_export(self):
        session_duration = round(time.time() - self.start_time, 2)
       
        self.show_survey(session_duration)

    def show_survey(self, duration):
        survey_win = tk.Toplevel(self)
        survey_win.title("Post-Session Feedback Survey")
        survey_win.geometry("800x700")
        survey_win.configure(bg="white")

    # Scrollable setup
        canvas = tk.Canvas(survey_win, bg="white")
        scrollbar = tk.Scrollbar(survey_win, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)

        inner = tk.Frame(canvas, bg="white")
        win_id = canvas.create_window((0, 0), window=inner, anchor="nw")

    # ✅ Fix width cutting off
        def on_canvas_resize(event):
            canvas.itemconfig(win_id, width=event.width)
        canvas.bind("<Configure>", on_canvas_resize)

        def on_frame_configure(event):
            canvas.configure(scrollregion=canvas.bbox("all"))
        inner.bind("<Configure>", on_frame_configure)

        def on_mousewheel(event):
            canvas.yview_scroll(int(-1*(event.delta/120)), "units")
        canvas.bind_all("<MouseWheel>", on_mousewheel)

    # Title
        tk.Label(inner, text="Post-Test Assessment",
             font=("Arial", 16, "bold"), bg="white").pack(pady=20)

        survey_questions = [
    "The simulation helped me understand Value Iteration.",
    "The Bellman update visualization was easy to understand.",
    "The policy arrows helped me understand the agent's decisions.",
    "The quiz questions improved my understanding of RL concepts.",
    "The learning environment was engaging and easy to use."
]

        self.survey_vars = []

        for q in survey_questions:

            frame = tk.Frame(inner, bg="white")
            frame.pack(fill="x", padx=40, pady=10)

            tk.Label(frame,
             text=q,
             wraplength=700,
             justify="left",
             font=("Arial", 11, "bold"),
             bg="white").pack(anchor="w")

            var = tk.StringVar()
            self.survey_vars.append(var)

            for opt in ["Strongly Disagree",
                "Disagree",
                "Neutral",
                "Agree",
                "Strongly Agree"]:

                tk.Radiobutton(frame,
                       text=opt,
                       variable=var,
                       value=opt,
                       bg="white",
                       font=("Arial", 11)).pack(anchor="w")
        tk.Button(inner, text="✅ Submit & Export Data",
              font=("Arial", 13, "bold"),
              bg="#28a745", fg="white",
              height=2, width=25,
              command=lambda: self.export_all_data(duration, survey_win)).pack(pady=40)

    def get_best_action_q(self, r, c):
        return ["↑","↓","←","→"][self.Q[r][c].index(max(self.Q[r][c]))]
    def q_learning_step(self):
        r, c = self.current_pos

        if random.random() < self.epsilon:
            action_idx = random.randint(0,3)
        else:
            action_idx = self.Q[r][c].index(max(self.Q[r][c]))

        moves = [(-1,0),(1,0),(0,-1),(0,1)]
        dr, dc = moves[action_idx]

        nr, nc = r+dr, c+dc
        if not (0 <= nr < 4 and 0 <= nc < 4):
            return

        reward = 10 if (nr,nc)==self.goal else -5 if (nr,nc) in self.traps else -0.1

        self.Q[r][c][action_idx] += self.alpha * (
            reward + self.gamma * max(self.Q[nr][nc]) - self.Q[r][c][action_idx]
    )

        self.current_pos = (nr, nc)
    import matplotlib.pyplot as plt

    def generate_quiz_graph(self):

        import os
        from datetime import datetime
        import matplotlib.pyplot as plt

        if len(self.quiz_history) == 0:
            return

        questions = list(range(1, len(self.quiz_history)+1))

        cumulative_correct = []
        count = 0

        for x in self.quiz_history:
            count += x
            cumulative_correct.append(count)

        cumulative_actual = list(range(1, len(self.quiz_history)+1))

        plt.figure(figsize=(8,5))

        plt.plot(
        questions,
        cumulative_actual,
        marker='o',
        linewidth=2,
        color='blue',
        label='Questions Attempted'
    )

        plt.plot(
        questions,
        cumulative_correct,
        marker='o',
        linewidth=2,
        color='green',
        label='Correct Answers'
    )

        plt.xlabel("Question Number")
        plt.ylabel("Count")
        plt.title("Bellman Quiz Performance")
        plt.legend()
        plt.grid(True)

    # Create folder once
        os.makedirs("quiz_graphs", exist_ok=True)

        filename = os.path.join(
        "quiz_graphs",
        f"quiz_performance_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
    )

        plt.savefig(filename)

        print("Graph saved at:", filename)
        print(os.path.abspath(filename))
        plt.close()
    def export_all_data(self, duration, window):

        import os
        import csv
        from datetime import datetime

        filename = "all_participants.csv"
        file_exists = os.path.isfile(filename)

        participant_no = 1

        if file_exists:
            with open(filename, 'r', encoding='utf-8') as f:
                participant_no = sum(
                1 for line in f
                if line.startswith("=== PARTICIPANT")
            ) + 1

        mcq_acc = (
            round(self.mcq_correct / self.mcq_attempts * 100, 1)
            if self.mcq_attempts > 0 else 0
    )

        pretest_score = getattr(self, "pretest_score", 0)

        survey_labels = [
        "The simulation helped me understand Value Iteration",
        "The Bellman update visualization was easy to understand",
        "The policy arrows helped me understand the agent's decisions",
        "The quiz questions improved my understanding of RL concepts",
        "The learning environment was engaging and easy to use"
    ]

    # Generate creator-only graph
        self.generate_quiz_graph()

        with open(filename, 'a', newline='', encoding='utf-8') as f:

            writer = csv.writer(f)

            if file_exists:
                writer.writerow([])

            writer.writerow([f"=== PARTICIPANT {participant_no} ==="])

            writer.writerow([
            "Start Time",
            datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ])

            writer.writerow(["Duration (seconds)", duration])
            writer.writerow(["Total Bellman Steps", self.bellman_steps])
            writer.writerow(["Run 8 Steps Used", self.run8_count])
            writer.writerow(["Move Agent Used", self.move_agent_count])
            writer.writerow(["MCQ Attempts", self.mcq_attempts])
            writer.writerow(["MCQ Correct Answers", self.mcq_correct])
            writer.writerow(["MCQ Accuracy (%)", mcq_acc])
            writer.writerow(["Pre-Test Score", pretest_score])

            writer.writerow([])

            # ── survey responses + SUS score ────────────────────────
            writer.writerow(["=== SURVEY RESPONSES ==="])
            if hasattr(self, 'survey_vars') and self.survey_vars:
                score_map = {
        "Strongly Disagree": 1,
        "Disagree":          2,
        "Neutral":           3,
        "Agree":             4,
        "Strongly Agree":    5
    }
                sus_total = 0
                for i, label in enumerate(survey_labels):
                    response = self.survey_vars[i].get() if i < len(self.survey_vars) else "N/A"
                    writer.writerow([label, response])
                    sus_total += score_map.get(response, 3) - 1  # 0–4 per question

                sus_score = round(sus_total * 5, 1)   # scale 0–20 → 0–100
                writer.writerow(["SUS Usability Score", sus_score])
            else:
                writer.writerow(["Survey", "Not administered in this session"])
        messagebox.showinfo(
        "Survey Submitted",
        "Thank you for completing the survey!"
    )

        messagebox.showinfo(
        "Export Successful",
        f"Data saved to: {filename}\n"
        f"Participant #{participant_no} recorded."
    )

        window.destroy()
        self.destroy()
    
if __name__ == "__main__":
    app = BellmanCartoonGame()
    app.mainloop()
