<template>
  <div class="stat-card">
    <div class="stat-top">
      <span class="label">{{ label }}</span>
      <span class="indicator" :class="color"></span>
    </div>

    <div class="value">
      {{ value }}
    </div>

    <div class="description">
      {{ description }}
    </div>
  </div>
</template>

<script setup>
defineProps({
  label: String,
  value: [String, Number],
  description: String,
  color: String
})
</script>

<style scoped>
.stat-card {
  flex: 1;
  min-width: 0;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 15px 17px;
  box-sizing: border-box;
}

.stat-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.3px;
}

.indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.indicator.green {
  background: var(--primary);
}

.indicator.yellow {
  background: var(--warning);
}

.indicator.blue {
  background: var(--info);
}

.indicator.gray {
  background: var(--text-muted);
}

.value {
  margin-top: 8px;
  font-size: 25px;
  line-height: 1;
  font-weight: 700;
  color: var(--text-main);
}

.description {
  margin-top: 8px;
  font-size: 9px;
  color: var(--text-muted);
}
</style>
