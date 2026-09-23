<template>
  <section class="trnk surface-standard">
    <h2 class="t-h3 trnk__title">排行榜</h2>
    <p class="t-body-2 trnk__head">
      已考 {{ rankData.attempt_count || 0 }} / {{ rankData.total_students || 0 }} 人 · 得分高且用时短者靠前
    </p>
    <div v-if="rankData.rank && rankData.rank.length" class="trnk__list">
      <div
        v-for="r in rankData.rank"
        :key="r.user_id"
        class="trnk__row"
        :class="{ 'is-me': r.is_me, 'is-top': r.rank <= 3 }"
      >
        <span class="trnk__no" :class="{ 'is-gold': r.rank === 1, 'is-silver': r.rank === 2, 'is-bronze': r.rank === 3 }">{{ r.rank }}</span>
        <span class="trnk__name">
          {{ r.user_id }}
          <UiTag v-if="r.is_timeout" variant="warning">超时</UiTag>
          <UiTag v-if="r.is_me" variant="brand-soft">我</UiTag>
        </span>
        <span class="trnk__score">{{ r.score }}<i> 分</i></span>
        <span class="trnk__meta">对 {{ r.correct_count }} 题 · {{ r.duration_sec }} 秒</span>
      </div>
    </div>
    <p v-else class="t-body-2">还没有人提交。</p>
  </section>
</template>

<script setup>
/**
 * 班级测试排行榜（答题页交卷后与排名查看共用）。
 * 排序规则由服务端保证：得分降序、用时升序。
 */
import UiTag from '../ui/UiTag.vue'

defineProps({
  rankData: { type: Object, default: () => ({}) },
})
</script>

<style scoped>
.trnk {
  padding: var(--sp-4) var(--sp-5);
  margin-bottom: var(--sp-4);
}
.trnk__head {
  margin-bottom: var(--sp-3);
}
.trnk__list {
  display: grid;
  gap: var(--sp-2);
}
.trnk__row {
  display: grid;
  grid-template-columns: 32px 1fr auto;
  grid-template-areas: 'no name score' 'no meta meta';
  align-items: center;
  column-gap: var(--sp-3);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-md);
}
.trnk__row.is-me {
  background: var(--primary-soft-2, rgba(124, 92, 255, 0.1));
}
.trnk__no {
  grid-area: no;
  font-weight: var(--fw-semibold);
  color: var(--text-secondary);
}
.trnk__no.is-gold { color: #d9a514; }
.trnk__no.is-silver { color: #9aa5b1; }
.trnk__no.is-bronze { color: #c07a3d; }
.trnk__name {
  grid-area: name;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-primary);
}
.trnk__score {
  grid-area: score;
  font-weight: var(--fw-medium);
  color: var(--text-primary);
}
.trnk__score i {
  font-style: normal;
  font-size: var(--fs-label);
  color: var(--text-tertiary);
}
.trnk__meta {
  grid-area: meta;
  font-size: var(--fs-label);
  color: var(--text-tertiary);
}
</style>
