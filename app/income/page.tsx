"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import "./income.css";

const supabase = createClient();

type IncomeRecord = {
  id: string;
  amount: number;
  category: string;
  memo: string | null;
  income_date: string;
  created_at: string;
};

type EditForm = {
  amount: string;
  category: string;
  memo: string;
  income_date: string;
};

const incomeCategories = [
  "급여",
  "용돈",
  "상여금",
  "정산금",
  "투자수익",
  "기타 수입",
];

const categoryIcons: Record<string, string> = {
  급여: "💵",
  용돈: "✉️",
  상여금: "🎁",
   정산금: "🤝",
  투자수익: "📈",
  "기타 수입": "•••",
};

export default function IncomePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] =
    useState<string | null>(null);

  const [incomes, setIncomes] =
    useState<IncomeRecord[]>([]);

  const [selectedIncome, setSelectedIncome] =
    useState<IncomeRecord | null>(null);

  const [editForm, setEditForm] =
    useState<EditForm>({
      amount: "",
      category: "급여",
      memo: "",
      income_date: "",
    });

  const [message, setMessage] = useState("");

  const loadIncomes = async () => {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/login");
      return;
    }

    setUserId(user.id);

    const { data, error } = await supabase
      .from("incomes")
      .select(
        `
          id,
          amount,
          category,
          memo,
          income_date,
          created_at
        `,
      )
      .eq("user_id", user.id)
      .order("income_date", {
        ascending: false,
      })
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "소득 기록 조회 오류:",
        error,
      );

      setMessage(
        "소득 기록을 불러오지 못했어요.",
      );

      setLoading(false);
      return;
    }

    setIncomes(
      (data as IncomeRecord[] | null) ?? [],
    );

    setLoading(false);
  };

  useEffect(() => {
    void loadIncomes();
  }, []);

  const openEdit = (
    income: IncomeRecord,
  ) => {
    setSelectedIncome(income);

    setEditForm({
      amount: String(income.amount),
      category: income.category,
      memo: income.memo ?? "",
      income_date: income.income_date,
    });

    setMessage("");
  };

  const closeEdit = () => {
    if (saving) {
      return;
    }

    setSelectedIncome(null);
    setMessage("");
  };

  const handleUpdate = async () => {
    if (!selectedIncome || !userId) {
      return;
    }

    const numericAmount =
      Number(editForm.amount || 0);

    if (numericAmount <= 0) {
      setMessage(
        "금액을 1원 이상 입력해 주세요.",
      );
      return;
    }

    if (!editForm.income_date) {
      setMessage("날짜를 선택해 주세요.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("incomes")
      .update({
        amount: numericAmount,
        category: editForm.category,
        memo:
          editForm.memo.trim() || null,
        income_date:
          editForm.income_date,
      })
      .eq("id", selectedIncome.id)
      .eq("user_id", userId);

    if (error) {
      console.error(
        "소득 수정 오류:",
        error,
      );

      setMessage(
        "소득 기록을 수정하지 못했어요.",
      );

      setSaving(false);
      return;
    }

    setSelectedIncome(null);
    setSaving(false);

    await loadIncomes();
  };

  const handleDelete = async (
    income: IncomeRecord,
  ) => {
    if (!userId || saving) {
      return;
    }

    const confirmed = window.confirm(
      `${income.amount.toLocaleString(
        "ko-KR",
      )}원 소득 기록을 삭제할까요?`,
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("incomes")
      .delete()
      .eq("id", income.id)
      .eq("user_id", userId);

    if (error) {
      console.error(
        "소득 삭제 오류:",
        error,
      );

      setMessage(
        "소득 기록을 삭제하지 못했어요.",
      );

      setSaving(false);
      return;
    }

    if (
      selectedIncome?.id === income.id
    ) {
      setSelectedIncome(null);
    }

    setSaving(false);

    await loadIncomes();
  };

  const totalIncome = incomes.reduce(
    (total, income) =>
      total + Number(income.amount),
    0,
  );

  if (loading) {
    return (
      <main className="income-page-loading">
        소득 기록을 불러오고 있어요...
      </main>
    );
  }

  return (
    <main className="income-page">
      <header className="income-page-header">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="뒤로 가기"
        >
          ←
        </button>

        <h1>소득 관리</h1>

        <span />
      </header>

      <section className="income-summary">
        <span>등록된 총 소득</span>

        <strong>
          {totalIncome.toLocaleString(
            "ko-KR",
          )}
          원
        </strong>

        <small>
          총 {incomes.length}건의 기록
        </small>
      </section>

      {message && !selectedIncome && (
        <p className="income-page-message">
          {message}
        </p>
      )}

      <section className="income-list-section">
        <div className="income-list-title">
          <h2>소득 기록</h2>

          <span>{incomes.length}건</span>
        </div>

        {incomes.length === 0 ? (
          <div className="income-empty">
            <span>💰</span>

            <strong>
              아직 등록된 소득이 없어요
            </strong>

            <p>
              홈에서 소득을 추가하면
              이곳에서 수정할 수 있어요.
            </p>

            <button
              type="button"
              onClick={() => router.push("/")}
            >
              홈으로 돌아가기
            </button>
          </div>
        ) : (
          <div className="income-record-list">
            {incomes.map((income) => (
              <article
                className="income-record-card"
                key={income.id}
              >
                <button
                  type="button"
                  className="income-record-main"
                  onClick={() =>
                    openEdit(income)
                  }
                >
                  <span className="income-record-icon">
                    {categoryIcons[
                      income.category
                    ] ?? "💰"}
                  </span>

                  <span className="income-record-info">
                    <strong>
                      {income.category}
                    </strong>

                    <small>
                      {income.income_date}
                      {income.memo
                        ? ` · ${income.memo}`
                        : ""}
                    </small>
                  </span>

                  <span className="income-record-amount">
                    +
                    {Number(
                      income.amount,
                    ).toLocaleString(
                      "ko-KR",
                    )}
                    원
                  </span>
                </button>

                <div className="income-record-actions">
                  <button
                    type="button"
                    onClick={() =>
                      openEdit(income)
                    }
                  >
                    수정
                  </button>

                  <button
                    type="button"
                    className="delete"
                    disabled={saving}
                    onClick={() =>
                      handleDelete(income)
                    }
                  >
                    삭제
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedIncome && (
        <div
          className="income-edit-backdrop"
          onClick={closeEdit}
        >
          <section
            className="income-edit-sheet"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="income-edit-handle" />

            <header className="income-edit-header">
              <h2>소득 수정</h2>

              <button
                type="button"
                disabled={saving}
                onClick={closeEdit}
                aria-label="닫기"
              >
                ×
              </button>
            </header>

            <div className="income-edit-content">
              <label>
                <span>금액</span>

                <div className="income-edit-amount">
                  <span>₩</span>

                  <input
                    type="text"
                    inputMode="numeric"
                    value={
                      editForm.amount
                        ? Number(
                            editForm.amount,
                          ).toLocaleString(
                            "ko-KR",
                          )
                        : ""
                    }
                    disabled={saving}
                    placeholder="0"
                    onChange={(event) => {
                      const value =
                        event.target.value.replace(
                          /[^0-9]/g,
                          "",
                        );

                      setEditForm(
                        (current) => ({
                          ...current,
                          amount: value,
                        }),
                      );

                      setMessage("");
                    }}
                  />
                </div>
              </label>

              <div>
                <span className="income-edit-label">
                  소득 종류
                </span>

                <div className="income-edit-categories">
                  {incomeCategories.map(
                    (category) => (
                      <button
                        type="button"
                        key={category}
                        disabled={saving}
                        className={
                          editForm.category ===
                          category
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          setEditForm(
                            (current) => ({
                              ...current,
                              category,
                            }),
                          )
                        }
                      >
                        <span>
                          {categoryIcons[
                            category
                          ]}
                        </span>

                        <small>
                          {category}
                        </small>
                      </button>
                    ),
                  )}
                </div>
              </div>

              <label>
                <span>날짜</span>

                <input
                  type="date"
                  value={
                    editForm.income_date
                  }
                  disabled={saving}
                  onChange={(event) =>
                    setEditForm(
                      (current) => ({
                        ...current,
                        income_date:
                          event.target.value,
                      }),
                    )
                  }
                />
              </label>

              <label>
                <span>
                  메모 <small>선택</small>
                </span>

                <div className="income-edit-memo">
                  <textarea
                    maxLength={50}
                    value={editForm.memo}
                    disabled={saving}
                    placeholder="메모를 입력해주세요"
                    onChange={(event) =>
                      setEditForm(
                        (current) => ({
                          ...current,
                          memo:
                            event.target.value,
                        }),
                      )
                    }
                  />

                  <small>
                    {editForm.memo.length}/50
                  </small>
                </div>
              </label>

              {message && (
                <p className="income-edit-message">
                  {message}
                </p>
              )}
            </div>

            <div className="income-edit-buttons">
              <button
                type="button"
                className="income-edit-delete"
                disabled={saving}
                onClick={() =>
                  handleDelete(
                    selectedIncome,
                  )
                }
              >
                삭제
              </button>

              <button
                type="button"
                className="income-edit-save"
                disabled={
                  saving ||
                  Number(
                    editForm.amount,
                  ) <= 0
                }
                onClick={handleUpdate}
              >
                {saving
                  ? "저장하는 중..."
                  : "수정 완료"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}