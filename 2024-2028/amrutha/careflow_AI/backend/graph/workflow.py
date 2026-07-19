from langgraph.graph import StateGraph
from graph.state import CareFlowState
from agents.patient_agent import patient_agent
from agents.doctor_agent import doctor_agent

graph = StateGraph(CareFlowState)

graph.add_node("patient", patient_agent)
graph.add_node("doctor", doctor_agent)

graph.set_entry_point("patient")
graph.add_edge("patient", "doctor")

careflow_graph = graph.compile()
