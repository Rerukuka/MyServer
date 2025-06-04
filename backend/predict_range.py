import torch
import numpy as np
import torch.nn as nn
from collections import Counter

# Файл модели и Nonce
nonce_file = "Txt/nonces.txt"
model_path = "Txt/model.pth"

# Константа максимального значения
MAX_NONCE = 4294967294

# Чтение данных из файла с ограничением
def load_nonce():
    with open(nonce_file, "r") as f:
        return [min(int(line.strip()), MAX_NONCE) for line in f.readlines()]

# Определение LSTM-модели (ДОЛЖНА совпадать с train_ai.py)
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

print(" Загрузка обученной модели...")
model = LSTMModel().to(device)
model.load_state_dict(torch.load(model_path, map_location=device))
model.eval()

print(" Чтение файла Nonces...")
nonce_list = load_nonce()
if not nonce_list:
    print("⚠ Файл пуст. Завершение работы.")
    exit()

# Анализ частот встречаемости
nonce_counts = Counter(nonce_list)
most_common_nonce, most_common_count = nonce_counts.most_common(1)[0]
least_common_nonce, least_common_count = min(nonce_counts.items(), key=lambda x: x[1])

# Определение диапазонов (±10%) с учетом максимального значения
range_min = int(min(most_common_nonce * 0.9, MAX_NONCE))
range_max = int(min(most_common_nonce * 1.1, MAX_NONCE))

rare_min = int(min(least_common_nonce * 0.9, MAX_NONCE))
rare_max = int(min(least_common_nonce * 1.1, MAX_NONCE))

# Убеждаемся, что значения не превышают максимум
range_min = min(range_min, MAX_NONCE)
range_max = min(range_max, MAX_NONCE)
rare_min = min(rare_min, MAX_NONCE)
rare_max = min(rare_max, MAX_NONCE)

print(f" Наиболее вероятный диапазон Nonce: ({range_min}, {range_max})")
with open("Txt/nonce_range.txt", "w") as file:
    file.truncate(0)  # Удаляет всё содержимое
    file.write(f"{range_min},{range_max}")
print(f" Наименее вероятный диапазон Nonce: ({rare_min}, {rare_max})")