# 🏙️ Semantic Segmentation on Cityscapes using U-Net + MobileNetV2

This project performs semantic segmentation on urban street scenes from the Cityscapes dataset using a hybrid deep learning model that combines U-Net architecture with a MobileNetV2 encoder.

Semantic segmentation assigns a class label to every pixel in an image, enabling detailed scene understanding for applications such as autonomous driving and smart cities. :contentReference[oaicite:0]{index=0}

---

## 🚀 Features

- Pixel-level classification of urban scenes  
- U-Net decoder with MobileNetV2 backbone  
- Designed for road-scene understanding  
- Training and evaluation on Cityscapes dataset  
- Visualization of segmentation results  

---

## 🧠 Technologies Used

- Python  
- TensorFlow / Keras  
- Deep Learning (CNN)  
- MobileNetV2 (Pretrained Encoder)  
- U-Net Architecture  
- NumPy & Matplotlib  

---

## 🏗️ Model Architecture

The model combines:

- **MobileNetV2** → Lightweight feature extractor (encoder)  
- **U-Net** → Decoder with skip connections for precise segmentation  

This hybrid approach provides both efficiency and accuracy for dense prediction tasks.

---

## 🗂️ Dataset

- **Cityscapes Dataset**
- High-resolution urban street images
- Pixel-level annotations for multiple object classes
- Common classes include road, buildings, vehicles, pedestrians, etc.

Cityscapes is widely used for semantic understanding of urban environments.

---

## ⚙️ How to Run

1. Clone the repository:

```
git clone https://github.com/kowshik102007/Semantic-Segmentation-on-Cityscapes-using-U-Net-MobileNetV2.git
cd Semantic-Segmentation-on-Cityscapes-using-U-Net-MobileNetV2
```

2. Install required libraries:

```
pip install -r requirements.txt
```

3. Run the training or prediction script:

```
python main.py
```
