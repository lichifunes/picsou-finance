package com.picsou.repository;

import com.picsou.model.AccountHolding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Set;

public interface AccountHoldingRepository extends JpaRepository<AccountHolding, Long> {

    List<AccountHolding> findByAccountIdOrderByCurrentPriceDesc(Long accountId);

    void deleteByAccountId(Long accountId);

    @Query("SELECT DISTINCT h.ticker FROM AccountHolding h WHERE h.ticker IS NOT NULL")
    Set<String> findDistinctTickers();
}
