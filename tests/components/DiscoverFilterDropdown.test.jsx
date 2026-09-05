import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DiscoverFilterDropdown from '../../src/components/discover/DiscoverFilterDropdown';

const OPTIONS = [
  { value: '', label: 'Any style' },
  { value: 'Trap', label: 'Trap' },
  { value: 'Drill', label: 'Drill' },
  { value: 'Rage', label: 'Rage', disabled: true },
];

function Harness() {
  const [value, setValue] = useState('');
  return (
    <>
      <DiscoverFilterDropdown
        id="style-filter"
        testId="style-filter-trigger"
        label="Style"
        value={value}
        options={OPTIONS}
        onChange={setValue}
      />
      <output data-testid="selected-value">{value}</output>
      <button type="button">Outside</button>
    </>
  );
}

describe('DiscoverFilterDropdown', () => {
  it('uses listbox semantics and roving Arrow/Home/End keyboard navigation', async () => {
    render(<Harness />);
    const trigger = screen.getByTestId('style-filter-trigger');

    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const options = screen.getAllByRole('option');
    await waitFor(() => expect(options[0]).toHaveFocus());

    fireEvent.keyDown(options[0], { key: 'ArrowDown' });
    await waitFor(() => expect(options[1]).toHaveFocus());
    fireEvent.keyDown(options[1], { key: 'End' });
    await waitFor(() => expect(options[2]).toHaveFocus());
    fireEvent.keyDown(options[2], { key: 'Enter' });

    expect(screen.getByTestId('selected-value')).toHaveTextContent('Drill');
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes with Escape and restores focus to the trigger', async () => {
    render(<Harness />);
    const trigger = screen.getByTestId('style-filter-trigger');
    fireEvent.click(trigger);
    const listbox = screen.getByRole('listbox');

    fireEvent.keyDown(listbox, { key: 'Escape' });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes on Tab and returns focus from the portalled panel', async () => {
    render(<Harness />);
    const trigger = screen.getByTestId('style-filter-trigger');
    fireEvent.click(trigger);
    const option = screen.getAllByRole('option')[0];
    await waitFor(() => expect(option).toHaveFocus());

    fireEvent.keyDown(option, { key: 'Tab' });
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes on outside pointer input and never renders a native select', async () => {
    const { container } = render(<Harness />);
    const trigger = screen.getByTestId('style-filter-trigger');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
    expect(container.querySelector('select')).toBeNull();
  });
});
