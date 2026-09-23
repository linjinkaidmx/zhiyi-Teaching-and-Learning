"""把本地生成的种子题（seed_*.py，零 API 成本）导入题库。

用法：python _import_seed.py
- 读取同目录下所有 seed_*.py 的 SEED 列表
- 构造完整的讲解结构（缺失 steps 时自动从突破口/答案补齐，保证前端步骤板块不空）
- 走 bank.add_to_bank 入库（按归一化去重，可安全重跑）
"""
import glob
import importlib.util
import os
import sys
from collections import Counter

import bank
import db

HERE = os.path.dirname(os.path.abspath(__file__))


def load_seed_files():
    items = []
    for path in sorted(glob.glob(os.path.join(HERE, "seed_*.py"))):
        name = os.path.basename(path)[:-3]
        spec = importlib.util.spec_from_file_location(name, path)
        mod = importlib.util.module_from_spec(spec)
        sys.modules[name] = mod
        spec.loader.exec_module(mod)
        seed = getattr(mod, "SEED", [])
        items.extend(seed)
        print(f"  载入 {os.path.basename(path)}: {len(seed)} 道")
    return items


def build_result(it: dict) -> dict:
    """把种子题构造成讲解结果结构（与 AI 讲解返回一致）。"""
    kb = it.get("key_breakthrough", "") or ""
    ans = it.get("answer", "") or ""
    steps = it.get("steps")
    if not steps:
        # 未单独写步骤时，从「突破口 + 答案」自动补齐，保证前端步骤板块有内容
        steps = [
            {"title": "思路与突破口", "detail": kb or "见下方「关键突破口」。"},
            {"title": "推导与结论", "detail": ans},
        ]
    return {
        "subject": it.get("subject", ""),
        "question_type": it.get("question_type", ""),
        "answer": ans,
        "steps": steps,
        "key_breakthrough": kb,
        "knowledge_points": it.get("knowledge_points", []) or [],
        "knowledge_review": it.get("knowledge_review", ""),
        "extensions": it.get("extensions", []) or [],
        "diagnosis": "",
    }


def next_free(base: str, ext: str) -> str:
    """返回一个尚不存在的文件路径（本环境不允许覆盖已存在文件，故递增命名）。"""
    i = 1
    while True:
        p = os.path.join(HERE, f"{base}_{i}.{ext}")
        if not os.path.exists(p):
            return p
        i += 1


def main():
    # 用独立的重建库（每次新建文件，避免旧库被占用/只读导致无法写入）
    db.DATA_DIR = os.path.join(HERE, "data")
    os.makedirs(db.DATA_DIR, exist_ok=True)
    db.DB_FILE = os.path.join(db.DATA_DIR, next_free("zhiyi_seed", "db").split(os.sep)[-1])
    db.DB_FILE = next_free(os.path.join("data", "zhiyi_seed"), "db")
    db.init_db()
    before = db.bank_count()
    print("== 载入种子文件 ==")
    items = load_seed_files()
    print(f"\n共 {len(items)} 道待入库")

    ok = 0
    counter = Counter()
    for it in items:
        q = (it.get("question") or "").strip()
        if not q:
            continue
        result = build_result(it)
        if not result["answer"]:
            continue
        try:
            bank.add_to_bank(q, result)
            ok += 1
            counter[result["subject"]] += 1
        except Exception as e:
            print(f"  入库失败（跳过）: {q[:30]}... -> {e}")

    print(f"\n== 入库完成：{ok} 道（去重前）==")
    print("学科分布：")
    for subj, n in sorted(counter.items(), key=lambda x: -x[1]):
        print(f"  {subj}: {n}")
    print(f"\n题库总数：{before} → {db.bank_count()}")

    # 导出完整题库（新文件，供服务器导入）
    all_items = db.load_all_bank()
    out = next_free("bank_full", "json")
    import json
    with open(out, "w", encoding="utf-8") as f:
        json.dump(all_items, f, ensure_ascii=False, indent=1)
    print(f"已导出 {out}（{len(all_items)} 道）")


if __name__ == "__main__":
    main()
