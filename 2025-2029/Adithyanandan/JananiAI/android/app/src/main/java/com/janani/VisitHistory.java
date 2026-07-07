package com.janani;

import android.database.Cursor;
import android.graphics.Color;
import android.os.Bundle;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import com.github.mikephil.charting.charts.LineChart;
import com.github.mikephil.charting.components.XAxis;
import com.github.mikephil.charting.data.Entry;
import com.github.mikephil.charting.data.LineData;
import com.github.mikephil.charting.data.LineDataSet;
import com.github.mikephil.charting.formatter.ValueFormatter;
import java.util.ArrayList;
import java.util.List;

public class VisitHistory extends AppCompatActivity {
    private LineChart bpChart;
    private LineChart hbChart;
    private TextView noDataText;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_visit_history);

        int patientId = getIntent().getIntExtra("PATIENT_ID", -1);

        bpChart = findViewById(R.id.bp_chart);
        hbChart = findViewById(R.id.hb_chart);
        noDataText = findViewById(R.id.no_data_text);

        loadVisitHistory(patientId);
    }

    private void loadVisitHistory(int patientId) {
        DatabaseHelper db = new DatabaseHelper(this);
        Cursor cursor = db.getVisitsForPatient(patientId);

        List<Entry> bpEntries = new ArrayList<>();
        List<Entry> hbEntries = new ArrayList<>();
        List<String> visitDates = new ArrayList<>();

        if (cursor.moveToFirst()) {
            int i = 0;
            do {
                int gaIndex = cursor.getColumnIndex("gestational_age_weeks");
                int sbpIndex = cursor.getColumnIndex("systolic_bp");
                int dbpIndex = cursor.getColumnIndex("diastolic_bp");
                int hbIndex = cursor.getColumnIndex("hemoglobin_gdl");
                int dateIndex = cursor.getColumnIndex("visit_date");
                int riskIndex = cursor.getColumnIndex("risk_label");

                float ga = cursor.getInt(gaIndex);
                float sbp = cursor.getInt(sbpIndex);
                float dbp = cursor.getInt(dbpIndex);
                float hb = (float) cursor.getDouble(hbIndex);
                String date = cursor.getString(dateIndex);
                String risk = cursor.getString(riskIndex);

                // For simplicity, use index as x value
                bpEntries.add(new Entry(i, sbp));
                hbEntries.add(new Entry(i, hb));
                visitDates.add("W" + (int) ga);

                i++;
            } while (cursor.moveToNext() && i < 20);  // Limit to 20 visits
        }
        cursor.close();

        if (bpEntries.isEmpty()) {
            noDataText.setVisibility(TextView.VISIBLE);
            bpChart.setVisibility(LineChart.GONE);
            hbChart.setVisibility(LineChart.GONE);
        } else {
            noDataText.setVisibility(TextView.GONE);
            setupBPChart(bpEntries, visitDates);
            setupHBChart(hbEntries, visitDates);
        }
    }

    private void setupBPChart(List<Entry> entries, List<String> labels) {
        LineDataSet dataSet = new LineDataSet(entries, "Systolic BP");
        dataSet.setColor(Color.parseColor("#C62828"));
        dataSet.setLineWidth(2f);
        dataSet.setCircleRadius(4f);
        dataSet.setDrawValues(false);

        LineData lineData = new LineData(dataSet);

        bpChart.setData(lineData);
        bpChart.getXAxis().setValueFormatter(new ValueFormatter() {
            @Override
            public String getFormattedValue(float value) {
                int idx = (int) value;
                if (idx >= 0 && idx < labels.size()) {
                    return labels.get(idx);
                }
                return "";
            }
        });
        bpChart.getXAxis().setPosition(XAxis.XAxisPosition.BOTTOM);
        bpChart.getAxisLeft().setAxisMinimum(80);
        bpChart.getAxisLeft().setAxisMaximum(200);
        bpChart.getDescription().setText("Systolic Blood Pressure (mmHg)");
        bpChart.invalidate();
    }

    private void setupHBChart(List<Entry> entries, List<String> labels) {
        LineDataSet dataSet = new LineDataSet(entries, "Hemoglobin");
        dataSet.setColor(Color.parseColor("#1565C0"));
        dataSet.setLineWidth(2f);
        dataSet.setCircleRadius(4f);
        dataSet.setDrawValues(false);

        LineData lineData = new LineData(dataSet);

        hbChart.setData(lineData);
        hbChart.getXAxis().setValueFormatter(new ValueFormatter() {
            @Override
            public String getFormattedValue(float value) {
                int idx = (int) value;
                if (idx >= 0 && idx < labels.size()) {
                    return labels.get(idx);
                }
                return "";
            }
        });
        hbChart.getXAxis().setPosition(XAxis.XAxisPosition.BOTTOM);
        hbChart.getAxisLeft().setAxisMinimum(5);
        hbChart.getAxisLeft().setAxisMaximum(15);
        hbChart.getDescription().setText("Hemoglobin (g/dL)");
        hbChart.invalidate();
    }
}