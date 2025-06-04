import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
import os

# Файлы
nonce_file = "Txt/nonces.txt"
model_path = "Txt/model.pth"

# Чтение данных
def load_nonce():
    with open(nonce_file, "r") as f:
        return [int(line.strip()) for line in f.readlines()]

# Нормализация данных
def normalize_data(nonce_list):
    min_val, max_val = min(nonce_list), max(nonce_list)
    norm_list = [(x - min_val) / (max_val - min_val) for x in nonce_list]
    return norm_list, min_val, max_val

# Подготовка данных
def prepare_data(nonce_list, seq_length=500):  # Используем 500 значений для предсказания
    X, y = [], []
    for i in range(len(nonce_list) - seq_length):
        X.append(nonce_list[i:i+seq_length])
        y.append(nonce_list[i+seq_length])
    return torch.tensor(X, dtype=torch.float32), torch.tensor(y, dtype=torch.float32)

# Определение LSTM-модели
class LSTMModel(nn.Module):
    def __init__(self, input_size=1, hidden_size=256, num_layers=3, dropout=0.3):
        super(LSTMModel, self).__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True, dropout=dropout)
        self.fc = nn.Linear(hidden_size, 1)

    def forward(self, x):
        out, _ = self.lstm(x)
        return self.fc(out[:, -1, :])

# Устройство
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print(" Чтение файла Nonces...")
nonce_list = load_nonce()
if not nonce_list:
    print("⚠ Файл пуст. Завершение работы.")
    exit()

# Подготовка данных
norm_nonce_list, min_nonce, max_nonce = normalize_data(nonce_list)
X_train, y_train = prepare_data(norm_nonce_list)

X_train, y_train = X_train.unsqueeze(-1).to(device), y_train.unsqueeze(-1).to(device)

# Проверка, есть ли уже обученная модель
model = LSTMModel().to(device)
if os.path.exists(model_path):
    print(" Загружены сохраненные веса модели!")
    model.load_state_dict(torch.load(model_path, map_location=device))
else:
    print(" Обучение с нуля...")

# Функция потерь и оптимизатор
criterion = nn.HuberLoss()
optimizer = optim.AdamW(model.parameters(), lr=0.001, weight_decay=1e-5)
scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=50, verbose=True)

epochs = 10  # Количество эпох
batch_size = 512  # Размер батча

print(" Начало (до)обучения...")
for epoch in range(epochs):
    total_loss = 0
    for i in range(0, len(X_train), batch_size):
        X_batch = X_train[i:i+batch_size]
        y_batch = y_train[i:i+batch_size]

        optimizer.zero_grad()
        outputs = model(X_batch)
        loss = criterion(outputs, y_batch)

        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

        optimizer.step()
        total_loss += loss.item()

    avg_loss = total_loss / (len(X_train) // batch_size)
    scheduler.step(avg_loss)

    print(f" Эпоха {epoch + 1}/{epochs} | Потери: {avg_loss:.6f}")

# Сохранение модели
torch.save(model.state_dict(), model_path)
print("✅ Обучение завершено. Модель сохранена!")
