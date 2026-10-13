/**
 * 教程接入组合式函数
 * ---------------------------------------------------------------------------
 * 页面里两行搞定：
 *   const { tourOpen, openTour } = useTour('teacher')   // setup
 *   <UiTour v-model="tourOpen" tour-key="teacher" />    // template
 *   <UiButton icon="help" @click="openTour" />          // 可重看入口
 * 首次进入该页会自动弹（没看过才弹），点「?」随时重看。
 */
import { onMounted, ref } from 'vue'
import { shouldAutoShowTour } from './tourState.js'

export function useTour(key) {
  const tourOpen = ref(false)
  onMounted(() => {
    if (key && shouldAutoShowTour(key)) tourOpen.value = true
  })
  function openTour() {
    tourOpen.value = true
  }
  return { tourOpen, openTour }
}
